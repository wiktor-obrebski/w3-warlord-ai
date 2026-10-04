import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import * as W3DestructableApi from "@lib/warcraft3-api/destructable";
import { debug } from "../../../debug";
import { Point, Vector } from "@lib/math";
import { WorldState } from "../../../perception/world-state";
import { TowerRushContext, TowerRushPhase } from "../tower-rush-context";
import { trainPeasant } from "../home-economy";

const STARTING_PEASANT_COUNT = 5;
const FORWARD_WORKER_COUNT = 3;
// Town Hall and Lumber Mill footprints are assumed, not verified, to be about
// 512 and 384 wide, so the closest non-overlapping centers are about 450
// apart along an axis; the search starts a little closer to cover diagonals
// of the build grid.
const MIN_LUMBER_MILL_DISTANCE = 384;
const MAX_LUMBER_MILL_DISTANCE = 1200;
const CANDIDATE_SPACING = 64;

export function updateStart(world: WorldState, context: TowerRushContext) {
  const { townHall, enemyMainGoldMine, homeGoldMine } = world;

  if (!townHall) {
    throw new Error("Tower rush start: Town Hall not found.");
  }

  if (!enemyMainGoldMine) {
    throw new Error("Tower rush start: enemy main gold mine not found.");
  }

  if (!homeGoldMine) {
    throw new Error("Tower rush start: home gold mine not found.");
  }

  const [lumberMillBuilder, homeWorker] =
    world.peasants.slice(FORWARD_WORKER_COUNT);

  if (!lumberMillBuilder || !homeWorker) {
    throw new Error(
      `Tower rush start: expected ${STARTING_PEASANT_COUNT} Peasants, found ${world.peasants.length}.`,
    );
  }

  context.forwardWorkers = world.peasants.slice(0, FORWARD_WORKER_COUNT);
  context.goldWorkers = [homeWorker];
  context.lumberWorkers = [lumberMillBuilder];

  for (const worker of context.forwardWorkers) {
    W3UnitApi.IssueImmediateOrder(worker, "militia");
  }

  orderLumberMill(lumberMillBuilder, townHall, homeGoldMine, world);
  W3UnitApi.IssueTargetOrder(homeWorker, "harvest", homeGoldMine);
  trainPeasant(townHall, world, context);

  context.phase = TowerRushPhase.MovingToEnemy;
}

// Spots are tried from the one closest to both the Town Hall and a tree;
// IssueBuildOrderById rejects blocked spots, so the order itself is the
// placement test. Only the half facing away from the gold mine is searched
// so the mill never stands in the way of gold workers.
function orderLumberMill(
  builder: W3UnitApi.unit,
  townHall: W3UnitApi.unit,
  mine: W3UnitApi.unit,
  world: WorldState,
) {
  const hall = positionOf(townHall);
  const trees = treePositions(builder, world);
  const sites = lumberMillCandidates(hall, positionOf(mine))
    .map((position) => ({
      position,
      hallDistance: new Vector(position, hall).length,
      treeDistance: nearestDistance(position, trees),
    }))
    .sort(
      (a, b) =>
        a.hallDistance + a.treeDistance - (b.hallDistance + b.treeDistance),
    );

  for (const site of sites) {
    const accepted = W3UnitApi.IssueBuildOrderById(
      builder,
      W3HumanApi.Building.LUMBER_MILL,
      site.position.x,
      site.position.y,
    );

    if (accepted) {
      debug(
        `Tower rush start: Lumber Mill ordered ${Math.floor(site.hallDistance)} from the Town Hall and ${Math.floor(site.treeDistance)} from a tree.`,
      );
      return;
    }
  }

  debug("Tower rush start: all Lumber Mill locations rejected.");
}

// Rings around the Town Hall, spaced about CANDIDATE_SPACING apart, on the
// half facing away from the gold mine.
function lumberMillCandidates(hall: Point, mine: Point): Point[] {
  const awayFromMine = new Vector(mine, hall).slope;
  const candidates: Point[] = [];

  for (
    let distance = MIN_LUMBER_MILL_DISTANCE;
    distance <= MAX_LUMBER_MILL_DISTANCE;
    distance += CANDIDATE_SPACING
  ) {
    const angleStep = CANDIDATE_SPACING / distance;

    for (let offset = -Math.PI / 2; offset <= Math.PI / 2; offset += angleStep) {
      candidates.push(
        hall.translate(new Vector(distance, 0).rotate(awayFromMine + offset)),
      );
    }
  }

  return candidates;
}

// Perception cannot tell trees apart from other destructables, so a harvest
// order is used as the test: Warcraft rejects it for non-trees. The builder's
// build order replaces these test orders.
function treePositions(builder: W3UnitApi.unit, world: WorldState): Point[] {
  return world.destructablesNearHomeByDistance
    .filter((destructable) =>
      W3UnitApi.IssueTargetOrder(builder, "harvest", destructable),
    )
    .map(
      (tree) =>
        new Point(
          W3DestructableApi.GetDestructableX(tree),
          W3DestructableApi.GetDestructableY(tree),
        ),
    );
}

// Without any trees every spot scores alike, leaving only the hall distance.
function nearestDistance(position: Point, others: Point[]): number {
  let nearest = others.length === 0 ? 0 : Infinity;

  for (const other of others) {
    nearest = Math.min(nearest, new Vector(position, other).length);
  }

  return nearest;
}

function positionOf(unit: W3UnitApi.unit): Point {
  return new Point(W3UnitApi.GetUnitX(unit), W3UnitApi.GetUnitY(unit));
}
