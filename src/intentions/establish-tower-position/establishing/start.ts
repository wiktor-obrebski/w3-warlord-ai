import * as W3HumanApi from '@lib/warcraft3-api/human';
import type { ActorControl } from '../../../contracts/actor-control';
import type { UnitId } from '../../../contracts/ids';
import type { OrderQueue } from '../../../contracts/orders';
import type { WarcraftProbes } from '../../../contracts/probes';
import type { DecisionRecorder } from '../../../contracts/record';
import { Point, Vector } from '@lib/math';
import type { Beliefs } from '../../../contracts/beliefs';
import { TowerRushState } from '../tower-rush.state';
import { positionOf } from '../tower-rush.assessments';
import { trainPeasant } from '../tower-rush-economy.ctrl';

export { updateStart };

interface UpdateStartArgs {
  beliefs: Beliefs;
  rush: TowerRushState;
  actorControl: ActorControl;
  orders: OrderQueue;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

function updateStart({
  beliefs,
  rush,
  actorControl,
  orders,
  probes,
  recorder,
}: UpdateStartArgs) {
  const { townHall, homeGoldMine } = beliefs.self;
  const enemyMainGoldMine = beliefs.enemy.mainGoldMine;

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
    beliefs.self.peasants.slice(ForwardWorkerCount);

  if (!lumberMillBuilder || !homeWorker) {
    throw new Error(
      `Tower rush start: expected ${StartingPeasantCount} Peasants, found ${beliefs.self.peasants.length}.`
    );
  }

  rush.forwardWorkers = beliefs.self.peasants.slice(0, ForwardWorkerCount);
  rush.goldWorkers = [homeWorker];
  rush.lumberWorkers = [lumberMillBuilder];

  // Nothing else has had a chance to claim the starting units yet.
  for (const actor of [...beliefs.self.peasants, townHall]) {
    if (!actorControl.request({ actor, request: 'normal' })) {
      throw new Error(
        'Tower rush start: a starting unit is already controlled.'
      );
    }
  }

  for (const worker of rush.forwardWorkers) {
    orders.queue({
      order: {
        kind: 'immediate',
        unit: worker,
        orderString: 'militia',
        reason: 'Tower rush: forward worker answers the Call to Arms',
      },
    });
  }

  orderLumberMill({
    builder: lumberMillBuilder,
    hall: positionOf({ beliefs, unit: townHall }),
    mine: homeGoldMine.position,
    beliefs,
    probes,
    recorder,
  });
  orders.queue({
    order: {
      kind: 'target',
      unit: homeWorker,
      orderString: 'harvest',
      target: { unit: homeGoldMine.unit },
      reason: 'Tower rush: home worker harvests gold',
    },
  });
  trainPeasant({ townHall, beliefs, rush, orders, recorder });
}

const StartingPeasantCount = 5;
const ForwardWorkerCount = 3;
// Town Hall and Lumber Mill footprints are assumed, not verified, to be about
// 512 and 384 wide, so the closest non-overlapping centers are about 450
// apart along an axis; the search starts a little closer to cover diagonals
// of the build grid.
const MinLumberMillDistance = 384;
const MaxLumberMillDistance = 1200;
const CandidateSpacing = 64;

interface OrderLumberMillArgs {
  builder: UnitId;
  hall: Point;
  mine: Point;
  beliefs: Beliefs;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

// Spots are tried from the one closest to both the Town Hall and a tree;
// Warcraft refuses a build order for a blocked spot, so the order itself is
// the placement test. Only the half facing away from the gold mine is
// searched so the mill never stands in the way of gold workers.
function orderLumberMill({
  builder,
  hall,
  mine,
  beliefs,
  probes,
  recorder,
}: OrderLumberMillArgs) {
  const trees = treePositions({ builder, beliefs, probes });
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
    const accepted = probes.tryBuild({
      unit: builder,
      building: W3HumanApi.Building.LUMBER_MILL,
      point: site.position,
    });

    if (accepted) {
      recorder.note({
        message: `Tower rush start: Lumber Mill ordered ${Math.floor(site.hallDistance)} from the Town Hall and ${Math.floor(site.treeDistance)} from a tree.`,
      });
      return;
    }
  }

  recorder.note({
    message: 'Tower rush start: all Lumber Mill locations rejected.',
  });
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
  builder: UnitId;
  beliefs: Beliefs;
  probes: WarcraftProbes;
}

// Beliefs cannot tell trees apart from other destructables, so a harvest
// order is used as the test: Warcraft rejects it for non-trees. The builder's
// build order replaces these test orders.
function treePositions({
  builder,
  beliefs,
  probes,
}: TreePositionsArgs): Point[] {
  return beliefs.self.destructablesNearHomeByDistance
    .filter(({ destructable }) =>
      probes.tryHarvest({ unit: builder, destructable })
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
