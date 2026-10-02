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

interface PlacementRules {
  mine: Point;
  enemyMain: Point;
  occupied: Point[];
  requireEnemyMainInReach: boolean;
}

// An accepted build order can still fail when the Peasant arrives (blocked
// spot, missing resources), so towers are counted from what actually exists
// or is on its way, and missing ones are re-ordered one Peasant at a time.
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

  if (world.scoutTowers.length >= TOWER_COUNT) {
    context.phase = TowerRushPhase.UpgradingTowers;
    return;
  }

  forgetAbandonedTowerSites(world, context);

  const towerPositions = world.scoutTowers.map((tower) => positionOf(tower));
  const sitesAwaitingTower = context.pendingTowerSites.filter(
    (site) => !hasStartedTower(site, towerPositions),
  );

  if (towerPositions.length + sitesAwaitingTower.length >= TOWER_COUNT) {
    return;
  }

  const builder = context.forwardWorkers.find((worker) =>
    isAvailableForwardPeasant(worker, world),
  );

  if (!builder) {
    return;
  }

  const rules = {
    mine: positionOf(world.enemyMainGoldMine),
    enemyMain,
    occupied: [
      ...towerPositions,
      ...sitesAwaitingTower.map((site) => site.position),
    ],
    requireEnemyMainInReach: true,
  };

  orderScoutTower(builder, rules, context);
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

// Idle, holding, or sent back to harvesting; anything else means the Peasant
// is on its way to a tower or constructing one.
function isAvailableForwardPeasant(
  worker: W3UnitApi.unit,
  world: WorldState,
): boolean {
  return (
    world.peasants.includes(worker) &&
    (world.idleUnits.includes(worker) ||
      world.holdingPositionUnits.includes(worker) ||
      world.harvestingUnits.includes(worker))
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

    if (
      orderScoutTowerNextToFirstTower(worker, searchRules, context) ||
      orderScoutTowerNearMine(worker, searchRules, context)
    ) {
      return;
    }
  }
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
      debug(
        `Tower rush: Scout Tower ordered next to the first tower after ${attempt} rejections${describeReach(rules)}.`,
      );
      return true;
    }
  }

  debug(
    `Tower rush: no spot next to the first tower accepted${describeReach(rules)}; searching around the mine.`,
  );

  return false;
}

function orderScoutTowerNearMine(
  worker: W3UnitApi.unit,
  rules: PlacementRules,
  context: TowerRushContext,
): boolean {
  let distance = MIN_DISTANCE_FROM_MINE;
  let rejections = 0;

  while (distance <= TOWER_REACH) {
    const position = randomPointAround(rules.mine, distance);

    if (tryOrderScoutTower(worker, position, rules, context)) {
      debug(
        `Tower rush: Scout Tower ordered ${distance} from the mine after ${rejections} rejections${describeReach(rules)}.`,
      );
      return true;
    }

    rejections++;

    if (rejections % REJECTIONS_PER_DISTANCE_INCREASE === 0) {
      distance += DISTANCE_INCREASE;
    }
  }

  debug(
    `Tower rush: no Scout Tower placement accepted within reach of the mine${describeReach(rules)}.`,
  );

  return false;
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

function describeReach(rules: PlacementRules): string {
  return rules.requireEnemyMainInReach
    ? " (mine and main hall in reach)"
    : " (only mine in reach)";
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
