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
const ATTEMPTS_NEXT_TO_FIRST_TOWER = 10;

interface PlacementRules {
  mine: Point;
  enemyMain: Point;
  requireEnemyMainInReach: boolean;
}

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

  const mine = {
    x: W3UnitApi.GetUnitX(world.enemyMainGoldMine),
    y: W3UnitApi.GetUnitY(world.enemyMainGoldMine),
  };

  for (const worker of context.forwardWorkers) {
    if (world.peasants.includes(worker) && !hasTowerSite(worker, context)) {
      orderScoutTower(worker, mine, enemyMain, context);
    }
  }

  if (allLivingForwardWorkersHaveTowerSites(world, context)) {
    context.phase = TowerRushPhase.UpgradingTowers;
  }
}

// Spots covering both the mine and the main hall are preferred; covering
// only the mine is accepted once the whole search has found no such spot.
function orderScoutTower(
  worker: W3UnitApi.unit,
  mine: Point,
  enemyMain: Point,
  context: TowerRushContext,
) {
  for (const requireEnemyMainInReach of [true, false]) {
    const rules = { mine, enemyMain, requireEnemyMainInReach };

    if (
      orderScoutTowerNextToFirstTower(worker, rules, context) ||
      orderScoutTowerNearMine(worker, rules, context)
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
  const firstSite = context.towerSites[0];

  if (!firstSite) {
    return false;
  }

  for (let attempt = 0; attempt < ATTEMPTS_NEXT_TO_FIRST_TOWER; attempt++) {
    const position = randomPointOnSquareAround(
      firstSite.position,
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
    !overlapsTowerSite(position, context.towerSites) &&
    W3UnitApi.IssueBuildOrderById(
      worker,
      W3HumanApi.Building.SCOUT_TOWER,
      position.x,
      position.y,
    );

  if (accepted) {
    context.towerSites.push({ builder: worker, position });
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

function overlapsTowerSite(position: Point, sites: TowerSite[]): boolean {
  return sites.some(
    (site) =>
      Math.abs(site.position.x - position.x) < MIN_TOWER_CENTER_OFFSET &&
      Math.abs(site.position.y - position.y) < MIN_TOWER_CENTER_OFFSET,
  );
}

function hasTowerSite(
  worker: W3UnitApi.unit,
  context: TowerRushContext,
): boolean {
  return context.towerSites.some((site) => site.builder === worker);
}

function allLivingForwardWorkersHaveTowerSites(
  world: WorldState,
  context: TowerRushContext,
): boolean {
  return context.forwardWorkers
    .filter((worker) => world.peasants.includes(worker))
    .every((worker) => hasTowerSite(worker, context));
}

function distanceBetween(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
