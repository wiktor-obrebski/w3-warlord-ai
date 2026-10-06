import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3MathApi from "@lib/warcraft3-api/math";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../../debug";
import { Point, Vector } from "@lib/math";
import {
  GlobalBeliefs,
  lifeFractionOf,
  positionOf,
} from "../../../beliefs/global.beliefs";
import { TowerRushState } from "../tower-rush.state";
import {
  closestUnit,
  forgetSentToSafety,
  hideBehindClosestTower,
  isAvailableForwardPeasant,
} from "../forward-workers";
import {
  isWorkerSafe,
  WorkerSafety,
} from "../../maintain-worker-safety/worker-safety.ctrl";

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

interface TowerSite {
  builder: W3UnitApi.unit;
  position: Point;
}

interface TowerHelper {
  helper: W3UnitApi.unit;
  tower: W3UnitApi.unit;
}

export interface BuildTowersState {
  // Build orders whose builder is still busy with them.
  pendingTowerSites: TowerSite[];
  // Repair orders on unfinished towers whose helper is still busy with them.
  towerHelpers: TowerHelper[];
}

export function createBuildTowersState(): BuildTowersState {
  return { pendingTowerSites: [], towerHelpers: [] };
}

interface PlacementRules {
  mine: Point;
  enemyMain: Point;
  occupied: Point[];
  requireEnemyMainInReach: boolean;
}

/**
 * Returns where the rush towers stand once building them is finished.
 *
 * An accepted build order can still fail when the Peasant arrives (blocked
 * spot, missing resources), so towers are counted from what actually exists
 * or is on its way, and missing ones are re-ordered one Peasant at a time.
 * Once every tower is accounted for, free forward Peasants help unfinished
 * towers; only when all towers are built do they hide behind them, and
 * building ends once all of them are sent to hide.
 */
export function updateBuildTowers(
  beliefs: Readonly<GlobalBeliefs>,
  rush: TowerRushState,
  state: BuildTowersState,
  workerSafety: WorkerSafety,
): Point[] | undefined {
  const enemyMain = beliefs.enemyStartPosition;

  if (!enemyMain) {
    throw new Error("Tower rush: enemy start position not found.");
  }

  if (!beliefs.enemyMainGoldMine) {
    throw new Error("Tower rush: enemy main gold mine not found.");
  }

  forgetAbandonedTowerSites(beliefs, state);
  forgetFinishedTowerHelpers(beliefs, state);

  const towerPositions = beliefs.scoutTowers.map((tower) =>
    positionOf(beliefs, tower),
  );
  const sitesAwaitingTower = state.pendingTowerSites.filter(
    (site) => !hasStartedTower(site, towerPositions),
  );
  const safeWorkers = rush.forwardWorkers.filter((worker) =>
    isWorkerSafe(workerSafety, worker, beliefs.time),
  );
  const freeWorkers = safeWorkers.filter((worker) =>
    isAvailableForwardPeasant(worker, beliefs),
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
      freeWorkers[0] ?? busyNonBuilder(safeWorkers, beliefs, state);

    if (builder) {
      forgetSentToSafety(builder, rush);
      state.towerHelpers = state.towerHelpers.filter(
        (help) => help.helper !== builder,
      );
      orderScoutTower(
        builder,
        {
          mine: beliefs.enemyMainGoldMine.position,
          enemyMain,
          occupied: [
            ...towerPositions,
            ...sitesAwaitingTower.map((site) => site.position),
          ],
          requireEnemyMainInReach: true,
        },
        beliefs,
        state,
      );
    }
  } else if (towerPositions.length >= TOWER_COUNT) {
    if (allTowersBuilt(beliefs)) {
      for (const worker of freeWorkers) {
        if (!rush.forwardWorkersSentToSafety.includes(worker)) {
          hideBehindClosestTower(
            worker,
            beliefs.scoutTowers,
            enemyMain,
            beliefs,
            rush,
          );
        }
      }
    } else {
      for (const worker of freeWorkers) {
        helpUnfinishedTower(worker, beliefs, state);
      }
    }
  }

  if (!rush.reservingGoldForUpgrades && towersHalfBuilt(beliefs)) {
    rush.reservingGoldForUpgrades = true;
    debug("Tower rush: reserving gold for the Guard Tower upgrades.");
  }

  return towerBuildingFinished(beliefs, rush) ? towerPositions : undefined;
}

// A missing tower must not wait for a free Peasant: Warcraft can keep a
// Peasant busy on its own, e.g. attacking or repairing, until the other
// towers finish. Any living, safe forward Peasant that is not building a
// tower is taken off its order instead.
function busyNonBuilder(
  safeWorkers: W3UnitApi.unit[],
  beliefs: Readonly<GlobalBeliefs>,
  state: BuildTowersState,
): W3UnitApi.unit | undefined {
  const builders = state.pendingTowerSites.map((site) => site.builder);
  const worker = safeWorkers.find(
    (candidate) =>
      beliefs.peasants.includes(candidate) && !builders.includes(candidate),
  );

  if (worker) {
    debug(
      "Tower rush: forward Peasant taken off its current order to build the missing tower.",
    );
  }

  return worker;
}

function allTowersBuilt(beliefs: Readonly<GlobalBeliefs>): boolean {
  return (
    beliefs.scoutTowers.length >= TOWER_COUNT &&
    beliefs.scoutTowers.every(
      (tower) => !beliefs.buildingsUnderConstruction.includes(tower),
    )
  );
}

// A tower without a living builder would never finish, so it is taken over
// first. Otherwise a second worker only pays off early in construction.
function helpUnfinishedTower(
  worker: W3UnitApi.unit,
  beliefs: Readonly<GlobalBeliefs>,
  state: BuildTowersState,
) {
  const unfinished = beliefs.scoutTowers.filter((tower) =>
    beliefs.buildingsUnderConstruction.includes(tower),
  );
  const abandoned = closestUnit(
    unfinished.filter((tower) => !hasLivingBuilder(tower, beliefs, state)),
    worker,
    beliefs,
  );
  const tower =
    abandoned ??
    closestUnit(
      unfinished.filter(
        (tower) =>
          buildProgress(tower, beliefs) < MAX_BUILD_PROGRESS_WORTH_HELPING,
      ),
      worker,
      beliefs,
    );

  if (!tower) {
    return;
  }

  // Human Peasants help an unfinished building through the repair order.
  if (W3UnitApi.IssueTargetOrder(worker, "repair", tower)) {
    state.towerHelpers.push({ helper: worker, tower });
    debug(
      `Tower rush: forward Peasant ${abandoned ? "takes over" : "helps"} a tower at ${Math.floor(buildProgress(tower, beliefs) * 100)}% progress.`,
    );
  } else {
    debug("Tower rush: repair order rejected.");
  }
}

// Builders and helpers are only remembered while they are alive and busy.
function hasLivingBuilder(
  tower: W3UnitApi.unit,
  beliefs: Readonly<GlobalBeliefs>,
  state: BuildTowersState,
): boolean {
  const towerPosition = positionOf(beliefs, tower);

  return (
    state.pendingTowerSites.some(
      (site) =>
        new Vector(site.position, towerPosition).length <=
        STARTED_TOWER_MATCH_DISTANCE,
    ) || state.towerHelpers.some((help) => help.tower === tower)
  );
}

// Warcraft exposes no construction progress, but a building's life rises
// linearly from a fraction of its maximum while it is built. A damaged
// finished tower reads as low progress too.
function buildProgress(
  tower: W3UnitApi.unit,
  beliefs: Readonly<GlobalBeliefs>,
): number {
  return (
    (lifeFractionOf(beliefs, tower) - CONSTRUCTION_START_LIFE_FRACTION) /
    (1 - CONSTRUCTION_START_LIFE_FRACTION)
  );
}

// From here the towers finish soon enough that the upgrade gold must already
// be at hand, or the last upgrade waits for income.
function towersHalfBuilt(beliefs: Readonly<GlobalBeliefs>): boolean {
  return (
    beliefs.scoutTowers.length >= TOWER_COUNT &&
    beliefs.scoutTowers.every(
      (tower) =>
        lifeFractionOf(beliefs, tower) >= RESERVE_UPGRADE_GOLD_LIFE_FRACTION,
    )
  );
}

// Helpers that are free again have finished or abandoned their help.
function forgetFinishedTowerHelpers(
  beliefs: Readonly<GlobalBeliefs>,
  state: BuildTowersState,
) {
  state.towerHelpers = state.towerHelpers.filter(
    (help) =>
      beliefs.peasants.includes(help.helper) &&
      !isAvailableForwardPeasant(help.helper, beliefs) &&
      beliefs.scoutTowers.includes(help.tower),
  );
}

// A Peasant is only sent to safety once it is done building and helping, so
// building need not wait for it to arrive; upgrades can start meanwhile.
function towerBuildingFinished(
  beliefs: Readonly<GlobalBeliefs>,
  rush: TowerRushState,
): boolean {
  const livingForwardPeasants = rush.forwardWorkers.filter((worker) =>
    beliefs.peasants.includes(worker),
  );

  return (
    (beliefs.scoutTowers.length >= TOWER_COUNT ||
      livingForwardPeasants.length === 0) &&
    livingForwardPeasants.every((worker) =>
      rush.forwardWorkersSentToSafety.includes(worker),
    )
  );
}

// Before its tower starts, a site lasts only while its builder still carries
// the build order; any other order means the build was given up, even when
// Warcraft gave that order on its own. Once the tower has started, the site
// marks the tower's builder until the builder is free again.
function forgetAbandonedTowerSites(
  beliefs: Readonly<GlobalBeliefs>,
  state: BuildTowersState,
) {
  const towerPositions = beliefs.scoutTowers.map((tower) =>
    positionOf(beliefs, tower),
  );

  state.pendingTowerSites = state.pendingTowerSites.filter((site) => {
    const started = hasStartedTower(site, towerPositions);
    const builderAlive = beliefs.peasants.includes(site.builder);
    const builderBusy =
      builderAlive &&
      (beliefs.scoutTowerBuildOrderUnits.includes(site.builder) ||
        (started && !isAvailableForwardPeasant(site.builder, beliefs)));

    if (!builderBusy && !started) {
      // PROBE (temporary): gold, lumber, and how far the nearest tower stands.
      debug(
        `Tower rush: Scout Tower build failed before it started; retrying. PROBE gold ${beliefs.gold}, lumber ${beliefs.lumber}, nearest tower ${probeNearestTower(site.position, towerPositions)} away.`,
      );
    }

    return builderBusy;
  });
}

function hasStartedTower(site: TowerSite, towerPositions: Point[]): boolean {
  return towerPositions.some(
    (tower) =>
      new Vector(tower, site.position).length <= STARTED_TOWER_MATCH_DISTANCE,
  );
}

// Spots covering both the mine and the main hall are preferred; covering
// only the mine is accepted once the whole search has found no such spot.
function orderScoutTower(
  worker: W3UnitApi.unit,
  rules: PlacementRules,
  beliefs: Readonly<GlobalBeliefs>,
  state: BuildTowersState,
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

    if (orderScoutTowerNextToFirstTower(worker, searchRules, state)) {
      debug(`Tower rush: Scout Tower ordered next to the first tower; ${coverage}.`);
      return;
    }

    const distanceFromMine = orderScoutTowerNearMine(worker, searchRules, state);

    if (distanceFromMine !== undefined) {
      debug(
        `Tower rush: Scout Tower ordered ${distanceFromMine} from the mine; ${coverage}.`,
      );
      return;
    }
  }

  debug(
    `Tower rush: no Scout Tower placement accepted. PROBE rejections: enemy main too close ${probeRejections.enemyMainTooClose}, enemy main out of reach ${probeRejections.enemyMainOutOfReach}, mine out of reach ${probeRejections.mineOutOfReach}, overlaps ${probeRejections.overlaps}, Warcraft ${probeRejections.warcraft}; gold ${beliefs.gold}.`,
  );
}

let lastProbeState = "";

function probeNearestTower(position: Point, towers: Point[]): string {
  let nearest: number | undefined;

  for (const tower of towers) {
    const distance = new Vector(tower, position).length;

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
  state: BuildTowersState,
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

    if (tryOrderScoutTower(worker, position, rules, state)) {
      return true;
    }
  }

  return false;
}

// Returns the distance from the mine at which the tower was ordered.
function orderScoutTowerNearMine(
  worker: W3UnitApi.unit,
  rules: PlacementRules,
  state: BuildTowersState,
): number | undefined {
  let distance = MIN_DISTANCE_FROM_MINE;
  let rejections = 0;

  while (distance <= TOWER_REACH) {
    const position = randomPointAround(rules.mine, distance);

    if (tryOrderScoutTower(worker, position, rules, state)) {
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
  state: BuildTowersState,
): boolean {
  const distanceToEnemyMain = new Vector(rules.enemyMain, position).length;
  const distanceToMine = new Vector(rules.mine, position).length;

  // PROBE (temporary): tally the first failing rule.
  if (distanceToEnemyMain < MIN_DISTANCE_FROM_ENEMY_MAIN) {
    probeRejections.enemyMainTooClose++;
  } else if (rules.requireEnemyMainInReach && distanceToEnemyMain > TOWER_REACH) {
    probeRejections.enemyMainOutOfReach++;
  } else if (distanceToMine > TOWER_REACH) {
    probeRejections.mineOutOfReach++;
  } else if (overlapsTower(position, rules.occupied)) {
    probeRejections.overlaps++;
  }

  const passesRules =
    distanceToEnemyMain >= MIN_DISTANCE_FROM_ENEMY_MAIN &&
    (!rules.requireEnemyMainInReach || distanceToEnemyMain <= TOWER_REACH) &&
    distanceToMine <= TOWER_REACH &&
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
    state.pendingTowerSites.push({ builder: worker, position });
  }

  return accepted;
}

function randomPointAround(center: Point, distance: number): Point {
  const angle = W3MathApi.GetRandomReal(0, Math.PI * 2);

  return center.translate(new Vector(distance, 0).rotate(angle));
}

// A point on the square of the given half-size, so that a tower placed there
// sits flush against the one at the center from any direction.
function randomPointOnSquareAround(center: Point, halfSize: number): Point {
  const angle = W3MathApi.GetRandomReal(0, Math.PI * 2);
  const direction = new Vector(1, 0).rotate(angle);
  const scale =
    halfSize / Math.max(Math.abs(direction.x), Math.abs(direction.y));

  return center.translate(direction.multiply(scale));
}

function overlapsTower(position: Point, towers: Point[]): boolean {
  return towers.some((tower) => {
    const offset = new Vector(tower, position);

    return (
      Math.abs(offset.x) < MIN_TOWER_CENTER_OFFSET &&
      Math.abs(offset.y) < MIN_TOWER_CENTER_OFFSET
    );
  });
}
