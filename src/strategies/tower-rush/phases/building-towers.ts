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
// Only once every tower is accounted for do free forward Peasants help
// unfinished towers, then hide behind a tower; the phase ends once all of
// them are sent to hide.
export function updateBuildingTowers(
  world: WorldState,
  context: TowerRushContext,
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
  const freeWorkers = context.forwardWorkers.filter((worker) =>
    isAvailableForwardPeasant(worker, world),
  );

  if (towerPositions.length + sitesAwaitingTower.length < TOWER_COUNT) {
    const builder = freeWorkers[0];

    if (builder) {
      forgetSentToSafety(builder, context);
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
        context,
      );
    }
  } else {
    for (const worker of freeWorkers) {
      helpTowerOrHide(worker, world, enemyMain, context);
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

function helpTowerOrHide(
  worker: W3UnitApi.unit,
  world: WorldState,
  enemyMain: Point,
  context: TowerRushContext,
) {
  const towerToHelp = closestUnit(
    world.scoutTowers.filter((tower) => needsHelp(tower, context)),
    worker,
  );

  if (towerToHelp) {
    // Human Peasants help an unfinished building through the repair order.
    if (W3UnitApi.IssueTargetOrder(worker, "repair", towerToHelp)) {
      forgetSentToSafety(worker, context);
      context.towerHelpers.push({ helper: worker, tower: towerToHelp });
      debug(
        `Tower rush: forward Peasant helps a tower at ${Math.floor(buildProgress(towerToHelp) * 100)}% progress.`,
      );
      return;
    }

    debug("Tower rush: repair order rejected.");
  }

  hideBehindClosestTower(worker, world.scoutTowers, enemyMain, context);
}

// A second worker only pays off early in construction; later it would just
// keep the Peasant exposed for little gain.
function needsHelp(tower: W3UnitApi.unit, context: TowerRushContext): boolean {
  const towerPosition = positionOf(tower);
  const builtByPendingSite = context.pendingTowerSites.some(
    (site) =>
      distanceBetween(site.position, towerPosition) <=
      STARTED_TOWER_MATCH_DISTANCE,
  );
  const helped = context.towerHelpers.some((help) => help.tower === tower);

  return (
    !builtByPendingSite &&
    !helped &&
    buildProgress(tower) < MAX_BUILD_PROGRESS_WORTH_HELPING
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

// A builder that is no longer busy has either started its tower, which is
// then counted from perception, or given up on it.
function forgetAbandonedTowerSites(
  world: WorldState,
  context: TowerRushContext,
) {
  context.pendingTowerSites = context.pendingTowerSites.filter(
    (site) =>
      world.peasants.includes(site.builder) &&
      !isAvailableForwardPeasant(site.builder, world),
  );
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
  context: TowerRushContext,
) {
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

  debug("Tower rush: no Scout Tower placement accepted.");
}

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
  const accepted =
    distanceToEnemyMain >= MIN_DISTANCE_FROM_ENEMY_MAIN &&
    (!rules.requireEnemyMainInReach || distanceToEnemyMain <= TOWER_REACH) &&
    distanceBetween(rules.mine, position) <= TOWER_REACH &&
    !overlapsTower(position, rules.occupied) &&
    W3UnitApi.IssueBuildOrderById(
      worker,
      W3HumanApi.Building.SCOUT_TOWER,
      position.x,
      position.y,
    );

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
