import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { Point, Vector } from '@lib/math';
import { CommonBeliefs, HomeDestructable } from '../../beliefs/common.beliefs';
import {
  completedLumberMill,
  lifeFractionOf,
  positionOf,
} from '../../beliefs/common.assessments';

export {
  RUSH_TOWER_COUNT,
  allRushTowersBuilt,
  rushTowersAtLeast,
  isAvailableForwardPeasant,
  lumberDestructablesByPreference,
};

const RUSH_TOWER_COUNT = 3;
const MillTreeCandidates = 4;

/** Whether every rush tower has been placed and finished construction. */
function allRushTowersBuilt({
  beliefs,
}: {
  beliefs: Readonly<CommonBeliefs>;
}): boolean {
  return (
    beliefs.scoutTowers.length >= RUSH_TOWER_COUNT &&
    beliefs.scoutTowers.every(
      (tower) => !beliefs.buildingsUnderConstruction.includes(tower)
    )
  );
}

/**
 * Whether every rush tower has been placed and stands at or above the life
 * fraction; during construction this tracks build progress.
 */
function rushTowersAtLeast({
  beliefs,
  lifeFraction,
}: {
  beliefs: Readonly<CommonBeliefs>;
  lifeFraction: number;
}): boolean {
  return (
    beliefs.scoutTowers.length >= RUSH_TOWER_COUNT &&
    beliefs.scoutTowers.every(
      (tower) => lifeFractionOf({ beliefs, unit: tower }) >= lifeFraction
    )
  );
}

/**
 * Whether the forward Peasant is free for a new order: idle, holding, or
 * sent back to harvesting. Anything else means it is busy with an order of
 * its own, such as building or repairing.
 */
function isAvailableForwardPeasant({
  beliefs,
  worker,
}: {
  beliefs: Readonly<CommonBeliefs>;
  worker: W3UnitApi.unit;
}): boolean {
  return (
    beliefs.peasants.includes(worker) &&
    (beliefs.idleUnits.includes(worker) ||
      beliefs.holdingPositionUnits.includes(worker) ||
      beliefs.harvestingUnits.includes(worker))
  );
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
}: {
  beliefs: Readonly<CommonBeliefs>;
  peasantOrigin: W3UnitApi.unit;
}): readonly HomeDestructable[] {
  const mill = completedLumberMill({ beliefs });

  if (!mill) {
    return destructablesAwayFromUnfinishedMill({ beliefs });
  }

  const nearestMill = sortByDistanceTo({
    destructables: beliefs.destructablesNearHomeByDistance,
    origin: positionOf({ beliefs, unit: mill }),
  });
  const candidates = sortByDistanceTo({
    destructables: nearestMill.slice(0, MillTreeCandidates),
    origin: positionOf({ beliefs, unit: peasantOrigin }),
  });

  return [...candidates, ...nearestMill.slice(MillTreeCandidates)];
}

function sortByDistanceTo({
  destructables,
  origin,
}: {
  destructables: readonly HomeDestructable[];
  origin: Point;
}): HomeDestructable[] {
  return destructables
    .map((destructable) => ({
      destructable,
      distance: new Vector({ start: origin, end: destructable.position })
        .length,
    }))
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.destructable);
}

// Nearest home first, with those on the far side of the Hall from the mill
// ahead of the rest. Before the mill is placed, simply nearest home.
function destructablesAwayFromUnfinishedMill({
  beliefs,
}: {
  beliefs: Readonly<CommonBeliefs>;
}): readonly HomeDestructable[] {
  const mill = beliefs.lumberMills[0];

  if (!mill) {
    return beliefs.destructablesNearHomeByDistance;
  }

  const hall = beliefs.ownStartPosition;
  const toMill = new Vector({
    start: hall,
    end: positionOf({ beliefs, unit: mill }),
  });
  const isAwayFromMill = ({
    destructable,
  }: {
    destructable: HomeDestructable;
  }) =>
    new Vector({ start: hall, end: destructable.position }).dot({
      vector: toMill,
    }) < 0;
  const nearHome = beliefs.destructablesNearHomeByDistance;

  return [
    ...nearHome.filter((destructable) => isAwayFromMill({ destructable })),
    ...nearHome.filter((destructable) => !isAwayFromMill({ destructable })),
  ];
}
