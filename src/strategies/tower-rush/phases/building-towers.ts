import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../../debug";
import { Point, WorldState } from "../../../perception/world-state";
import {
  TowerRushContext,
  TowerRushPhase,
  TowerSite,
} from "../tower-rush-context";

// Both the main hall and the gold mine should stay within reach once the
// Scout Towers are upgraded (Guard Tower range is 700), with margin for the
// distance being measured between centers.
const MAX_DISTANCE_TO_TARGET = 650;
// Observed: a rooted Tree of Life attacks, and killed Peasants and towers
// placed about 450 from its center. Towers must outrange it instead.
const MIN_DISTANCE_FROM_ENEMY_MAIN = 560;
const PREFERRED_DISTANCE_FROM_ENEMY_MAIN = 610;
const PREFERRED_DISTANCE_FROM_MINE = 500;
const PLACEMENT_SEARCH_RADIUS = 384;
const PLACEMENT_GRID_STEP = 64;
// A Scout Tower occupies 128x128, so closer sites would overlap.
const MIN_DISTANCE_BETWEEN_TOWERS = 160;

export function updateBuildingTowers(
  world: WorldState,
  context: TowerRushContext,
) {
  const candidates = placementCandidates(world, context);

  for (const worker of context.forwardWorkers) {
    if (world.peasants.includes(worker) && !hasTowerSite(worker, context)) {
      orderScoutTowerAtFirstFreeCandidate(worker, candidates, context);
    }
  }

  if (allLivingForwardWorkersHaveTowerSites(world, context)) {
    context.phase = TowerRushPhase.UpgradingTowers;
  }
}

function placementCandidates(
  world: WorldState,
  context: TowerRushContext,
): Point[] {
  const enemyMain = context.enemyMainPosition;

  if (!enemyMain) {
    throw new Error("Tower rush: enemy main position is not known.");
  }

  if (!world.enemyMainGoldMine) {
    throw new Error("Tower rush: enemy main gold mine not found.");
  }

  const enemyMine = {
    x: W3UnitApi.GetUnitX(world.enemyMainGoldMine),
    y: W3UnitApi.GetUnitY(world.enemyMainGoldMine),
  };
  const anchor = preferredTowerSpot(
    enemyMain,
    enemyMine,
    world.ownStartPosition,
  );
  const candidates: Point[] = [];

  for (
    let dx = -PLACEMENT_SEARCH_RADIUS;
    dx <= PLACEMENT_SEARCH_RADIUS;
    dx += PLACEMENT_GRID_STEP
  ) {
    for (
      let dy = -PLACEMENT_SEARCH_RADIUS;
      dy <= PLACEMENT_SEARCH_RADIUS;
      dy += PLACEMENT_GRID_STEP
    ) {
      const candidate = { x: anchor.x + dx, y: anchor.y + dy };
      const distanceToMain = distanceBetween(enemyMain, candidate);

      if (
        distanceToMain >= MIN_DISTANCE_FROM_ENEMY_MAIN &&
        distanceToMain <= MAX_DISTANCE_TO_TARGET &&
        distanceBetween(enemyMine, candidate) <= MAX_DISTANCE_TO_TARGET
      ) {
        candidates.push(candidate);
      }
    }
  }

  candidates.sort(
    (a, b) => distanceBetween(anchor, a) - distanceBetween(anchor, b),
  );

  return candidates;
}

// The point at the preferred distances from both the main hall and the mine,
// on the side facing home, which is where the forward workers arrive from.
function preferredTowerSpot(
  enemyMain: Point,
  enemyMine: Point,
  home: Point,
): Point {
  const [first, second] = circleIntersections(
    enemyMain,
    PREFERRED_DISTANCE_FROM_ENEMY_MAIN,
    enemyMine,
    PREFERRED_DISTANCE_FROM_MINE,
  );

  return distanceBetween(first, home) <= distanceBetween(second, home)
    ? first
    : second;
}

function circleIntersections(
  centerA: Point,
  radiusA: number,
  centerB: Point,
  radiusB: number,
): [Point, Point] {
  const distance = distanceBetween(centerA, centerB);
  const alongAToB = (radiusA ** 2 - radiusB ** 2 + distance ** 2) / (2 * distance);
  const halfChordSquared = radiusA ** 2 - alongAToB ** 2;

  if (halfChordSquared < 0) {
    throw new Error(
      `Tower rush: no tower spot at preferred distances; mine is ${distance} from the main hall.`,
    );
  }

  const halfChord = Math.sqrt(halfChordSquared);
  const direction = unitVector(centerA, centerB);
  const base = {
    x: centerA.x + direction.x * alongAToB,
    y: centerA.y + direction.y * alongAToB,
  };

  return [
    { x: base.x - direction.y * halfChord, y: base.y + direction.x * halfChord },
    { x: base.x + direction.y * halfChord, y: base.y - direction.x * halfChord },
  ];
}

// IssueBuildOrderById returns false for blocked or unbuildable spots (but
// true when only resources are missing), so the order itself is used as the
// placement test, like the Lumber Mill placement in Start.
function orderScoutTowerAtFirstFreeCandidate(
  worker: W3UnitApi.unit,
  candidates: Point[],
  context: TowerRushContext,
) {
  for (const position of candidates) {
    if (overlapsTowerSite(position, context.towerSites)) {
      continue;
    }

    const accepted = W3UnitApi.IssueBuildOrderById(
      worker,
      W3HumanApi.Building.SCOUT_TOWER,
      position.x,
      position.y,
    );

    if (accepted) {
      context.towerSites.push({ builder: worker, position });
      debug(
        `Tower rush: Scout Tower ordered at (${position.x}, ${position.y}).`,
      );
      return;
    }
  }

  debug(
    `Tower rush: all ${candidates.length} Scout Tower placements rejected.`,
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

function unitVector(from: Point, to: Point): Point {
  const length = distanceBetween(from, to);

  if (length === 0) {
    throw new Error("Tower rush: cannot take a direction between coincident points.");
  }

  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
}

function distanceBetween(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
