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

// The exact gold mine and Scout Tower footprints are not known here, so the
// search starts at the smallest plausible non-colliding distance and widens
// on rejection. The accepted distances are logged to tune these values.
const MIN_DISTANCE_FROM_MINE = 64;
const DISTANCE_INCREASE = 16;
const REJECTIONS_PER_DISTANCE_INCREASE = 10;
const MAX_DISTANCE_FROM_MINE = 800;
// Observed: a rooted Tree of Life attacks, and killed Peasants and towers
// placed about 450 from the enemy start location where it stands.
const MIN_DISTANCE_FROM_ENEMY_MAIN = 560;
// A Scout Tower occupies 128x128, so closer sites would overlap.
const MIN_DISTANCE_BETWEEN_TOWERS = 160;

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
      orderScoutTowerNearMine(worker, mine, enemyMain, context);
    }
  }

  if (allLivingForwardWorkersHaveTowerSites(world, context)) {
    context.phase = TowerRushPhase.UpgradingTowers;
  }
}

// IssueBuildOrderById returns false for blocked or unbuildable spots (but
// true when only resources are missing), so the order itself is used as the
// placement test.
function orderScoutTowerNearMine(
  worker: W3UnitApi.unit,
  mine: Point,
  enemyMain: Point,
  context: TowerRushContext,
) {
  let distance = MIN_DISTANCE_FROM_MINE;
  let rejections = 0;

  while (distance <= MAX_DISTANCE_FROM_MINE) {
    const angle = W3MathApi.GetRandomReal(0, Math.PI * 2);
    const position = {
      x: mine.x + Math.cos(angle) * distance,
      y: mine.y + Math.sin(angle) * distance,
    };

    if (
      distanceBetween(enemyMain, position) >= MIN_DISTANCE_FROM_ENEMY_MAIN &&
      !overlapsTowerSite(position, context.towerSites) &&
      W3UnitApi.IssueBuildOrderById(
        worker,
        W3HumanApi.Building.SCOUT_TOWER,
        position.x,
        position.y,
      )
    ) {
      context.towerSites.push({ builder: worker, position });
      debug(
        `Tower rush: Scout Tower ordered ${distance} from the mine after ${rejections} rejections.`,
      );
      return;
    }

    rejections++;

    if (rejections % REJECTIONS_PER_DISTANCE_INCREASE === 0) {
      distance += DISTANCE_INCREASE;
    }
  }

  debug(
    `Tower rush: no Scout Tower placement accepted within ${MAX_DISTANCE_FROM_MINE} of the mine.`,
  );
}

function overlapsTowerSite(position: Point, sites: TowerSite[]): boolean {
  return sites.some(
    (site) =>
      distanceBetween(site.position, position) < MIN_DISTANCE_BETWEEN_TOWERS,
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
