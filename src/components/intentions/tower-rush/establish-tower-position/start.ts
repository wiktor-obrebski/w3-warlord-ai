import * as W3UnitApi from '@lib/warcraft3-api/unit';
import * as W3HumanApi from '@lib/warcraft3-api/human';
import { debug } from '../../../../debug';
import type { ActorControl } from '../../../../contracts/actor-control';
import { Point, Vector } from '@lib/math';
import { CommonBeliefs } from '../../../../beliefs/common.beliefs';
import { positionOf } from '../../../../beliefs/common.assessments';
import { TowerRushState } from '../tower-rush.state';
import { trainPeasant } from '../tower-rush-economy.ctrl';

export { updateStart };

const StartingPeasantCount = 5;
const ForwardWorkerCount = 3;
// Town Hall and Lumber Mill footprints are assumed, not verified, to be about
// 512 and 384 wide, so the closest non-overlapping centers are about 450
// apart along an axis; the search starts a little closer to cover diagonals
// of the build grid.
const MinLumberMillDistance = 384;
const MaxLumberMillDistance = 1200;
const CandidateSpacing = 64;

interface UpdateStartArgs {
  beliefs: Readonly<CommonBeliefs>;
  rush: TowerRushState;
  actorControl: ActorControl;
}

function updateStart({ beliefs, rush, actorControl }: UpdateStartArgs) {
  const { townHall, enemyMainGoldMine, homeGoldMine } = beliefs;

  if (!townHall) {
    throw new Error('Tower rush start: Town Hall not found.');
  }

  if (!enemyMainGoldMine) {
    throw new Error('Tower rush start: enemy main gold mine not found.');
  }

  if (!homeGoldMine) {
    throw new Error('Tower rush start: home gold mine not found.');
  }

  const [lumberMillBuilder, homeWorker] =
    beliefs.peasants.slice(ForwardWorkerCount);

  if (!lumberMillBuilder || !homeWorker) {
    throw new Error(
      `Tower rush start: expected ${StartingPeasantCount} Peasants, found ${beliefs.peasants.length}.`
    );
  }

  rush.forwardWorkers = beliefs.peasants.slice(0, ForwardWorkerCount);
  rush.goldWorkers = [homeWorker];
  rush.lumberWorkers = [lumberMillBuilder];

  // Nothing else has had a chance to claim the starting units yet.
  for (const actor of [...beliefs.peasants, townHall]) {
    if (!actorControl.request({ actor, request: 'normal' })) {
      throw new Error(
        'Tower rush start: a starting unit is already controlled.'
      );
    }
  }

  for (const worker of rush.forwardWorkers) {
    W3UnitApi.IssueImmediateOrder(worker, 'militia');
  }

  orderLumberMill({
    builder: lumberMillBuilder,
    hall: positionOf({ beliefs, unit: townHall }),
    mine: homeGoldMine.position,
    beliefs,
  });
  W3UnitApi.IssueTargetOrder(homeWorker, 'harvest', homeGoldMine.unit);
  trainPeasant({ townHall, beliefs, rush });
}

interface OrderLumberMillArgs {
  builder: W3UnitApi.unit;
  hall: Point;
  mine: Point;
  beliefs: Readonly<CommonBeliefs>;
}

// Spots are tried from the one closest to both the Town Hall and a tree;
// IssueBuildOrderById rejects blocked spots, so the order itself is the
// placement test. Only the half facing away from the gold mine is searched
// so the mill never stands in the way of gold workers.
function orderLumberMill({
  builder,
  hall,
  mine,
  beliefs,
}: OrderLumberMillArgs) {
  const trees = treePositions({ builder, beliefs });
  const sites = lumberMillCandidates({ hall, mine })
    .map((position) => ({
      position,
      hallDistance: new Vector({ start: position, end: hall }).length,
      treeDistance: nearestDistance({ position, others: trees }),
    }))
    .sort(
      (a, b) =>
        a.hallDistance + a.treeDistance - (b.hallDistance + b.treeDistance)
    );

  for (const site of sites) {
    const accepted = W3UnitApi.IssueBuildOrderById(
      builder,
      W3HumanApi.Building.LUMBER_MILL,
      site.position.x,
      site.position.y
    );

    if (accepted) {
      debug({
        message: `Tower rush start: Lumber Mill ordered ${Math.floor(site.hallDistance)} from the Town Hall and ${Math.floor(site.treeDistance)} from a tree.`,
      });
      return;
    }
  }

  debug({ message: 'Tower rush start: all Lumber Mill locations rejected.' });
}

interface LumberMillCandidatesArgs {
  hall: Point;
  mine: Point;
}

// Rings around the Town Hall, spaced about CandidateSpacing apart, on the
// half facing away from the gold mine.
function lumberMillCandidates({
  hall,
  mine,
}: LumberMillCandidatesArgs): Point[] {
  const awayFromMine = new Vector({ start: mine, end: hall }).slope;
  const candidates: Point[] = [];

  for (
    let distance = MinLumberMillDistance;
    distance <= MaxLumberMillDistance;
    distance += CandidateSpacing
  ) {
    const angleStep = CandidateSpacing / distance;

    for (
      let offset = -Math.PI / 2;
      offset <= Math.PI / 2;
      offset += angleStep
    ) {
      candidates.push(
        hall.translate({
          vector: new Vector({ x: distance, y: 0 }).rotate({
            angle: awayFromMine + offset,
          }),
        })
      );
    }
  }

  return candidates;
}

interface TreePositionsArgs {
  builder: W3UnitApi.unit;
  beliefs: Readonly<CommonBeliefs>;
}

// Beliefs cannot tell trees apart from other destructables, so a harvest
// order is used as the test: Warcraft rejects it for non-trees. The builder's
// build order replaces these test orders.
function treePositions({ builder, beliefs }: TreePositionsArgs): Point[] {
  return beliefs.destructablesNearHomeByDistance
    .filter(({ destructable }) =>
      W3UnitApi.IssueTargetOrder(builder, 'harvest', destructable)
    )
    .map((tree) => tree.position);
}

interface NearestDistanceArgs {
  position: Point;
  others: Point[];
}

// Without any trees every spot scores alike, leaving only the hall distance.
function nearestDistance({ position, others }: NearestDistanceArgs): number {
  let nearest = others.length === 0 ? 0 : Infinity;

  for (const other of others) {
    nearest = Math.min(
      nearest,
      new Vector({ start: position, end: other }).length
    );
  }

  return nearest;
}
