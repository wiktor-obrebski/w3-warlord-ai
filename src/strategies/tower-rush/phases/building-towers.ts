import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3MathApi from "@lib/warcraft3-api/math";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../../debug";
import { Point, WorldState } from "../../../perception/world-state";
import {
  TowerRushContext,
  TowerRushPhase,
  TowerSite,
} from "../tower-rush-context";
import {
  closestUnit,
  forgetSentToSafety,
  hideBehindClosestTower,
  isAvailableForwardPeasant,
} from "../forward-workers";
import {
  isWorkerSafe,
  WorkerSafety,
} from "../../../capabilities/worker-safety";

const TOWER_COUNT = 3;
// Center distance at which a target still counts as within reach of the
// upgraded tower (Guard Tower range is 700). Not verified in-game.
const TOWER_REACH = 700;
// The exact gold mine and Scout Tower footprints are not known here, so the
// search starts at the smallest plausible non-colliding distance and widens
// on rejection. The accepted distances are logged to tune these values.
const MIN_DISTANCE_FROM_MINE = 64;
const DISTANCE_INCREASE = 16;
const REJECTIONS_PER_DISTANCE_INCREASE = 10;
// Observed: a rooted Tree of Life attacks. It killed Peasants and towers
// placed about 450 from the enemy start location where it stands, and still
// occasionally reached towers at 560.
const MIN_DISTANCE_FROM_ENEMY_MAIN = 620;
// A Scout Tower occupies a 128x128 square; the margin allows for Warcraft
// shifting the placement onto its build grid. Pending sites must be checked
// here because Warcraft only sees a tower once its construction has started.
const MIN_TOWER_CENTER_OFFSET = 160;
// How far Warcraft's grid snapping may move a tower from its ordered spot.
const STARTED_TOWER_MATCH_DISTANCE = 64;
const ATTEMPTS_NEXT_TO_FIRST_TOWER = 10;
const MAX_BUILD_PROGRESS_WORTH_HELPING = 0.5;
// Assumed, not verified in-game.
const CONSTRUCTION_START_LIFE_FRACTION = 0.1;
const RESERVE_UPGRADE_GOLD_LIFE_FRACTION = 0.5;

interface PlacementRules {
  mine: Point;
  enemyMain: Point;
  occupied: Point[];
  requireEnemyMainInReach: boolean;
}

// An accepted build order can still fail when the Peasant arrives (blocked
// spot, missing resources), so towers are counted from what actually exists
// or is on its way, and missing ones are re-ordered one Peasant at a time.
// Once every tower is accounted for, free forward Peasants help unfinished
// towers; only when all towers are built do they hide behind them, and the
// phase ends once all of them are sent to hide.
export function updateBuildingTowers(
  world: WorldState,
  context: TowerRushContext,
  workerSafety: WorkerSafety,
) {
  const enemyMain = world.enemyStartPosition;

  if (!enemyMain) {
    throw new Error("Tower rush: enemy start position not found.");
  }

  if (!world.enemyMainGoldMine) {
    throw new Error("Tower rush: enemy main gold mine not found.");
  }

  forgetAbandonedTowerSites(world, context);
  forgetFinishedTowerHelpers(world, context);

  const towerPositions = world.scoutTowers.map((tower) => positionOf(tower));
  const sitesAwaitingTower = context.pendingTowerSites.filter(
    (site) => !hasStartedTower(site, towerPositions),
  );
  const safeWorkers = context.forwardWorkers.filter((worker) =>
    isWorkerSafe(workerSafety, worker, world.time),
  );
  const freeWorkers = safeWorkers.filter((worker) =>
    isAvailableForwardPeasant(worker, world),
  );

  // PROBE (temporary): log the tower count whenever it changes, with how far
  // each pending site is from its nearest tower.
  const probeState = `${towerPositions.length} started, ${sitesAwaitingTower.length} awaiting (${sitesAwaitingTower
    .map((site) => probeNearestTower(site.position, towerPositions))
    .join(", ")} from nearest tower), ${freeWorkers.length} free`;
  if (probeState !== lastProbeState) {
    debug(`PROBE towers: ${probeState}`);
    lastProbeState = probeState;
  }

  // Free Peasants keep ordering missing towers, each attempt searching from
  // the beginning. An ordered tower can still fail when its builder arrives,
  // so free Peasants only help or hide once every tower has started; until
  // then they stay free to retry a failed build.
  if (towerPositions.length + sitesAwaitingTower.length < TOWER_COUNT) {
    const builder =
      freeWorkers[0] ?? busyNonBuilder(safeWorkers, world, context);

    if (builder) {
      forgetSentToSafety(builder, context);
      context.towerHelpers = context.towerHelpers.filter(
        (help) => help.helper !== builder,
      );
      orderScoutTower(
        builder,
        {
          mine: positionOf(world.enemyMainGoldMine),
          enemyMain,
          occupied: [
            ...towerPositions,
            ...sitesAwaitingTower.map((site) => site.position),
          ],
          requireEnemyMainInReach: true,
        },
        world,
        context,
      );
    }
  } else if (towerPositions.length >= TOWER_COUNT) {
    if (allTowersBuilt(world)) {
      for (const worker of freeWorkers) {
        if (!context.forwardWorkersSentToSafety.includes(worker)) {
          hideBehindClosestTower(worker, world.scoutTowers, enemyMain, context);
        }
      }
    } else {
      for (const worker of freeWorkers) {
        helpUnfinishedTower(worker, world, context);
      }
    }
  }

  if (!context.reservingGoldForUpgrades && towersHalfBuilt(world)) {
    context.reservingGoldForUpgrades = true;
    debug("Tower rush: reserving gold for the Guard Tower upgrades.");
  }

  if (towerBuildingFinished(world, context)) {
    context.towerPositions = towerPositions;
    context.phase = TowerRushPhase.UpgradingTowers;
  }
}

// A missing tower must not wait for a free Peasant: Warcraft can keep a
// Peasant busy on its own, e.g. attacking or repairing, until the other
// towers finish. Any living, safe forward Peasant that is not building a
// tower is taken off its order instead.
function busyNonBuilder(
  safeWorkers: W3UnitApi.unit[],
  world: WorldState,
  context: TowerRushContext,
): W3UnitApi.unit | undefined {
  const builders = context.pendingTowerSites.map((site) => site.builder);
  const worker = safeWorkers.find(
    (candidate) =>
      world.peasants.includes(candidate) && !builders.includes(candidate),
  );

  if (worker) {
    debug(
      "Tower rush: forward Peasant taken off its current order to build the missing tower.",
    );
  }

  return worker;
}

function allTowersBuilt(world: WorldState): boolean {
  return (
    world.scoutTowers.length >= TOWER_COUNT &&
    world.scoutTowers.every(
      (tower) => !world.buildingsUnderConstruction.includes(tower),
    )
  );
}

// A tower without a living builder would never finish, so it is taken over
// first. Otherwise a second worker only pays off early in construction.
function helpUnfinishedTower(
  worker: W3UnitApi.unit,
  world: WorldState,
  context: TowerRushContext,
) {
  const unfinished = world.scoutTowers.filter((tower) =>
    world.buildingsUnderConstruction.includes(tower),
  );
  const abandoned = closestUnit(
    unfinished.filter((tower) => !hasLivingBuilder(tower, context)),
    worker,
  );
  const tower =
    abandoned ??
    closestUnit(
      unfinished.filter(
        (tower) => buildProgress(tower) < MAX_BUILD_PROGRESS_WORTH_HELPING,
      ),
      worker,
    );

  if (!tower) {
    return;
  }

  // Human Peasants help an unfinished building through the repair order.
  if (W3UnitApi.IssueTargetOrder(worker, "repair", tower)) {
    context.towerHelpers.push({ helper: worker, tower });
    debug(
      `Tower rush: forward Peasant ${abandoned ? "takes over" : "helps"} a tower at ${Math.floor(buildProgress(tower) * 100)}% progress.`,
    );
  } else {
    debug("Tower rush: repair order rejected.");
  }
}

// Builders and helpers are only remembered while they are alive and busy.
function hasLivingBuilder(
  tower: W3UnitApi.unit,
  context: TowerRushContext,
): boolean {
  const towerPosition = positionOf(tower);

  return (
    context.pendingTowerSites.some(
      (site) =>
        distanceBetween(site.position, towerPosition) <=
        STARTED_TOWER_MATCH_DISTANCE,
    ) || context.towerHelpers.some((help) => help.tower === tower)
  );
}

// Warcraft exposes no construction progress, but a building's life rises
// linearly from a fraction of its maximum while it is built. A damaged
// finished tower reads as low progress too.
function buildProgress(tower: W3UnitApi.unit): number {
  return (
    (lifeFraction(tower) - CONSTRUCTION_START_LIFE_FRACTION) /
    (1 - CONSTRUCTION_START_LIFE_FRACTION)
  );
}

// From here the towers finish soon enough that the upgrade gold must already
// be at hand, or the last upgrade waits for income.
function towersHalfBuilt(world: WorldState): boolean {
  return (
    world.scoutTowers.length >= TOWER_COUNT &&
    world.scoutTowers.every(
      (tower) => lifeFraction(tower) >= RESERVE_UPGRADE_GOLD_LIFE_FRACTION,
    )
  );
}

function lifeFraction(unit: W3UnitApi.unit): number {
  return (
    W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE) /
    W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_MAX_LIFE)
  );
}

// Helpers that are free again have finished or abandoned their help.
function forgetFinishedTowerHelpers(
  world: WorldState,
  context: TowerRushContext,
) {
  context.towerHelpers = context.towerHelpers.filter(
    (help) =>
      world.peasants.includes(help.helper) &&
      !isAvailableForwardPeasant(help.helper, world) &&
      world.scoutTowers.includes(help.tower),
  );
}

// A Peasant is only sent to safety once it is done building and helping, so
// the phase need not wait for it to arrive; upgrades can start meanwhile.
function towerBuildingFinished(
  world: WorldState,
  context: TowerRushContext,
): boolean {
  const livingForwardPeasants = context.forwardWorkers.filter((worker) =>
    world.peasants.includes(worker),
  );

  return (
    (world.scoutTowers.length >= TOWER_COUNT ||
      livingForwardPeasants.length === 0) &&
    livingForwardPeasants.every((worker) =>
      context.forwardWorkersSentToSafety.includes(worker),
    )
  );
}

// Before its tower starts, a site lasts only while its builder still carries
// the build order; any other order means the build was given up, even when
// Warcraft gave that order on its own. Once the tower has started, the site
// marks the tower's builder until the builder is free again.
function forgetAbandonedTowerSites(
  world: WorldState,
  context: TowerRushContext,
) {
  const towerPositions = world.scoutTowers.map((tower) => positionOf(tower));

  context.pendingTowerSites = context.pendingTowerSites.filter((site) => {
    const started = hasStartedTower(site, towerPositions);
    const builderAlive = world.peasants.includes(site.builder);
    const builderBusy =
      builderAlive &&
      (world.scoutTowerBuildOrderUnits.includes(site.builder) ||
        (started && !isAvailableForwardPeasant(site.builder, world)));

    if (!builderBusy && !started) {
      // PROBE (temporary): gold, lumber, and how far the nearest tower stands.
      debug(
        `Tower rush: Scout Tower build failed before it started; retrying. PROBE gold ${world.gold}, lumber ${world.lumber}, nearest tower ${probeNearestTower(site.position, towerPositions)} away.`,
      );
    }

    return builderBusy;
  });
}

function hasStartedTower(site: TowerSite, towerPositions: Point[]): boolean {
  return towerPositions.some(
    (tower) =>
      distanceBetween(tower, site.position) <= STARTED_TOWER_MATCH_DISTANCE,
  );
}

// Spots covering both the mine and the main hall are preferred; covering
// only the mine is accepted once the whole search has found no such spot.
function orderScoutTower(
  worker: W3UnitApi.unit,
  rules: PlacementRules,
  world: WorldState,
  context: TowerRushContext,
) {
  probeRejections = {
    enemyMainTooClose: 0,
    enemyMainOutOfReach: 0,
    mineOutOfReach: 0,
    overlaps: 0,
    warcraft: 0,
  };

  for (const requireEnemyMainInReach of [true, false]) {
    const searchRules = { ...rules, requireEnemyMainInReach };
    const coverage = requireEnemyMainInReach
      ? "covers the mine and main hall"
      : "covers only the mine";

    if (orderScoutTowerNextToFirstTower(worker, searchRules, context)) {
      debug(`Tower rush: Scout Tower ordered next to the first tower; ${coverage}.`);
      return;
    }

    const distanceFromMine = orderScoutTowerNearMine(
      worker,
      searchRules,
      context,
    );

    if (distanceFromMine !== undefined) {
      debug(
        `Tower rush: Scout Tower ordered ${distanceFromMine} from the mine; ${coverage}.`,
      );
      return;
    }
  }

  debug(
    `Tower rush: no Scout Tower placement accepted. PROBE rejections: enemy main too close ${probeRejections.enemyMainTooClose}, enemy main out of reach ${probeRejections.enemyMainOutOfReach}, mine out of reach ${probeRejections.mineOutOfReach}, overlaps ${probeRejections.overlaps}, Warcraft ${probeRejections.warcraft}; gold ${world.gold}.`,
  );
}

let lastProbeState = "";

function probeNearestTower(position: Point, towers: Point[]): string {
  let nearest: number | undefined;

  for (const tower of towers) {
    const distance = distanceBetween(tower, position);

    if (nearest === undefined || distance < nearest) {
      nearest = distance;
    }
  }

  return nearest === undefined ? "none" : `${Math.floor(nearest)}`;
}

// PROBE (temporary): why placement attempts are rejected.
let probeRejections = {
  enemyMainTooClose: 0,
  enemyMainOutOfReach: 0,
  mineOutOfReach: 0,
  overlaps: 0,
  warcraft: 0,
};

function orderScoutTowerNextToFirstTower(
  worker: W3UnitApi.unit,
  rules: PlacementRules,
  context: TowerRushContext,
): boolean {
  const firstTower = rules.occupied[0];

  if (!firstTower) {
    return false;
  }

  for (let attempt = 0; attempt < ATTEMPTS_NEXT_TO_FIRST_TOWER; attempt++) {
    const position = randomPointOnSquareAround(
      firstTower,
      MIN_TOWER_CENTER_OFFSET,
    );

    if (tryOrderScoutTower(worker, position, rules, context)) {
      return true;
    }
  }

  return false;
}

// Returns the distance from the mine at which the tower was ordered.
function orderScoutTowerNearMine(
  worker: W3UnitApi.unit,
  rules: PlacementRules,
  context: TowerRushContext,
): number | undefined {
  let distance = MIN_DISTANCE_FROM_MINE;
  let rejections = 0;

  while (distance <= TOWER_REACH) {
    const position = randomPointAround(rules.mine, distance);

    if (tryOrderScoutTower(worker, position, rules, context)) {
      return distance;
    }

    rejections++;

    if (rejections % REJECTIONS_PER_DISTANCE_INCREASE === 0) {
      distance += DISTANCE_INCREASE;
    }
  }

  return undefined;
}

// IssueBuildOrderById returns false for blocked or unbuildable spots (but
// true when only resources are missing), so the order itself is used as the
// placement test.
function tryOrderScoutTower(
  worker: W3UnitApi.unit,
  position: Point,
  rules: PlacementRules,
  context: TowerRushContext,
): boolean {
  const distanceToEnemyMain = distanceBetween(rules.enemyMain, position);

  // PROBE (temporary): tally the first failing rule.
  if (distanceToEnemyMain < MIN_DISTANCE_FROM_ENEMY_MAIN) {
    probeRejections.enemyMainTooClose++;
  } else if (rules.requireEnemyMainInReach && distanceToEnemyMain > TOWER_REACH) {
    probeRejections.enemyMainOutOfReach++;
  } else if (distanceBetween(rules.mine, position) > TOWER_REACH) {
    probeRejections.mineOutOfReach++;
  } else if (overlapsTower(position, rules.occupied)) {
    probeRejections.overlaps++;
  }

  const passesRules =
    distanceToEnemyMain >= MIN_DISTANCE_FROM_ENEMY_MAIN &&
    (!rules.requireEnemyMainInReach || distanceToEnemyMain <= TOWER_REACH) &&
    distanceBetween(rules.mine, position) <= TOWER_REACH &&
    !overlapsTower(position, rules.occupied);
  const accepted =
    passesRules &&
    W3UnitApi.IssueBuildOrderById(
      worker,
      W3HumanApi.Building.SCOUT_TOWER,
      position.x,
      position.y,
    );

  if (passesRules && !accepted) {
    probeRejections.warcraft++;
  }

  if (accepted) {
    context.pendingTowerSites.push({ builder: worker, position });
  }

  return accepted;
}

function randomPointAround(center: Point, distance: number): Point {
  const angle = W3MathApi.GetRandomReal(0, Math.PI * 2);

  return {
    x: center.x + Math.cos(angle) * distance,
    y: center.y + Math.sin(angle) * distance,
  };
}

// A point on the square of the given half-size, so that a tower placed there
// sits flush against the one at the center from any direction.
function randomPointOnSquareAround(center: Point, halfSize: number): Point {
  const angle = W3MathApi.GetRandomReal(0, Math.PI * 2);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = halfSize / Math.max(Math.abs(cos), Math.abs(sin));

  return { x: center.x + cos * scale, y: center.y + sin * scale };
}

function overlapsTower(position: Point, towers: Point[]): boolean {
  return towers.some(
    (tower) =>
      Math.abs(tower.x - position.x) < MIN_TOWER_CENTER_OFFSET &&
      Math.abs(tower.y - position.y) < MIN_TOWER_CENTER_OFFSET,
  );
}

function positionOf(unit: W3UnitApi.unit): Point {
  return { x: W3UnitApi.GetUnitX(unit), y: W3UnitApi.GetUnitY(unit) };
}

function distanceBetween(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
