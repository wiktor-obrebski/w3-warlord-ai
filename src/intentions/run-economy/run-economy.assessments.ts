import { Point, Vector } from '@lib/math';
import type { UnitId } from '../../contracts/ids';
import type { HomeDestructable } from '../../contracts/world';
import type { Beliefs } from '../../contracts/beliefs';

export { lumberDestructablesByPreference, positionOf, completedLumberMill };

interface LumberDestructablesByPreferenceArgs {
  beliefs: Beliefs;
  peasantOrigin: UnitId;
}

/**
 * The destructables near home to harvest lumber from, best first.
 *
 * Near the finished Lumber Mill, where lumber is returned: of the few
 * destructables nearest the mill, the one nearest the Peasant comes first,
 * so the Peasant does not walk past good trees by the mill. Until the mill
 * is finished, nearest home, where the Town Hall takes the lumber, preferring
 * the side of the Hall away from the mill being built. Rallies and harvest
 * orders share this order so a new Peasant ordered to harvest is not turned
 * away from the tree it was rallied to.
 */
function lumberDestructablesByPreference({
  beliefs,
  peasantOrigin,
}: LumberDestructablesByPreferenceArgs): readonly HomeDestructable[] {
  const mill = completedLumberMill({ beliefs });

  if (!mill) {
    return destructablesAwayFromUnfinishedMill({ beliefs });
  }

  const nearestMill = sortByDistanceTo({
    destructables: beliefs.self.destructablesNearHomeByDistance,
    origin: positionOf({ beliefs, unit: mill }),
  });
  const candidates = sortByDistanceTo({
    destructables: nearestMill.slice(0, MillTreeCandidates),
    origin: positionOf({ beliefs, unit: peasantOrigin }),
  });

  return [...candidates, ...nearestMill.slice(MillTreeCandidates)];
}

interface PositionOfArgs {
  beliefs: Beliefs;
  unit: UnitId;
}

/** Throws for a unit not believed to be a living unit of the bot. */
function positionOf({ beliefs, unit }: PositionOfArgs): Point {
  const believed = beliefs.self.units.get(unit);

  if (!believed) {
    throw new Error('Economy: not a living unit of the bot.');
  }

  return believed.position;
}

interface CompletedLumberMillArgs {
  beliefs: Beliefs;
}

function completedLumberMill({
  beliefs,
}: CompletedLumberMillArgs): UnitId | undefined {
  return beliefs.self.lumberMills.find(
    (mill) => !beliefs.self.buildingsUnderConstruction.includes(mill)
  );
}

const MillTreeCandidates = 4;

interface SortByDistanceToArgs {
  destructables: readonly HomeDestructable[];
  origin: Point;
}

function sortByDistanceTo({
  destructables,
  origin,
}: SortByDistanceToArgs): HomeDestructable[] {
  return destructables
    .map((destructable) => ({
      destructable,
      distance: new Vector({ start: origin, end: destructable.position })
        .length,
    }))
    .sort((a, b) => a.distance - b.distance)
    .map((withDistance) => withDistance.destructable);
}

interface IsAwayFromMillArgs {
  destructable: HomeDestructable;
}

interface DestructablesAwayFromUnfinishedMillArgs {
  beliefs: Beliefs;
}

// Nearest home first, with those on the far side of the Hall from the mill
// ahead of the rest. Before the mill is placed, simply nearest home.
function destructablesAwayFromUnfinishedMill({
  beliefs,
}: DestructablesAwayFromUnfinishedMillArgs): readonly HomeDestructable[] {
  const mill = beliefs.self.lumberMills[0];

  if (!mill) {
    return beliefs.self.destructablesNearHomeByDistance;
  }

  const hall = beliefs.self.startPosition;
  const toMill = new Vector({
    start: hall,
    end: positionOf({ beliefs, unit: mill }),
  });
  const isAwayFromMill = ({ destructable }: IsAwayFromMillArgs) =>
    new Vector({ start: hall, end: destructable.position }).dot({
      vector: toMill,
    }) < 0;
  const nearHome = beliefs.self.destructablesNearHomeByDistance;

  return [
    ...nearHome.filter((destructable) => isAwayFromMill({ destructable })),
    ...nearHome.filter((destructable) => !isAwayFromMill({ destructable })),
  ];
}
