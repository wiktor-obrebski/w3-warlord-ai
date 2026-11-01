import * as W3HumanApi from '@lib/warcraft3-api/human';
import { Point, Vector } from '@lib/math';
import type { Beliefs } from '../../contracts/beliefs';
import type { Directive } from '../../contracts/directives';
import type { UnitId } from '../../contracts/ids';
import type { WarcraftProbes } from '../../contracts/probes';
import type { DecisionRecorder } from '../../contracts/record';

export { LUMBER_MILL_GOLD_COST, orderLumberMill };

// Warcraft's listed cost; not verified in-game. A Lumber Mill costs no
// lumber.
const LUMBER_MILL_GOLD_COST = 120;

interface OrderLumberMillArgs {
  builder: UnitId;
  hall: Point;
  mine: Point;
  beliefs: Beliefs;
  directives: Directive[];
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

/**
 * Orders the Lumber Mill, and returns its Build Directive; undefined when
 * every spot was rejected.
 *
 * Spots are tried from the one closest to both the Town Hall and a tree;
 * Warcraft refuses a build order for a blocked spot, so the order itself is
 * the placement test. Only the half facing away from the gold mine is
 * searched so the mill never stands in the way of gold workers.
 */
function orderLumberMill({
  builder,
  hall,
  mine,
  beliefs,
  directives,
  probes,
  recorder,
}: OrderLumberMillArgs): Directive | undefined {
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
        message: `Economy: Lumber Mill ordered ${Math.floor(site.hallDistance)} from the Town Hall and ${Math.floor(site.treeDistance)} from a tree.`,
      });

      const build: Directive = {
        unit: builder,
        task: {
          kind: 'Build',
          building: W3HumanApi.Building.LUMBER_MILL,
          point: site.position,
        },
        reason: 'Economy: Lumber Mill',
      };

      directives.push(build);

      return build;
    }
  }

  recorder.note({ message: 'Economy: all Lumber Mill locations rejected.' });

  return undefined;
}

// Town Hall and Lumber Mill footprints are assumed, not verified, to be about
// 512 and 384 wide, so the closest non-overlapping centers are about 450
// apart along an axis; the search starts a little closer to cover diagonals
// of the build grid.
const MinLumberMillDistance = 384;
const MaxLumberMillDistance = 1200;
const CandidateSpacing = 64;

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
