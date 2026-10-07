import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { Point, Vector } from "@lib/math";
import {
  CommonBeliefs,
  HomeDestructable,
} from "../../beliefs/common.beliefs";
import {
  completedLumberMill,
  lifeFractionOf,
  positionOf,
} from "../../beliefs/common.assessments";

export const RUSH_TOWER_COUNT = 3;
const MILL_TREE_CANDIDATES = 4;

/** Whether every rush tower has been placed and finished construction. */
export function allRushTowersBuilt(beliefs: Readonly<CommonBeliefs>): boolean {
  return (
    beliefs.scoutTowers.length >= RUSH_TOWER_COUNT &&
    beliefs.scoutTowers.every(
      (tower) => !beliefs.buildingsUnderConstruction.includes(tower),
    )
  );
}

/**
 * Whether every rush tower has been placed and stands at or above the life
 * fraction; during construction this tracks build progress.
 */
export function rushTowersAtLeast(
  beliefs: Readonly<CommonBeliefs>,
  lifeFraction: number,
): boolean {
  return (
    beliefs.scoutTowers.length >= RUSH_TOWER_COUNT &&
    beliefs.scoutTowers.every(
      (tower) => lifeFractionOf(beliefs, tower) >= lifeFraction,
    )
  );
}

/**
 * Whether the forward Peasant is free for a new order: idle, holding, or
 * sent back to harvesting. Anything else means it is busy with an order of
 * its own, such as building or repairing.
 */
export function isAvailableForwardPeasant(
  beliefs: Readonly<CommonBeliefs>,
  worker: W3UnitApi.unit,
): boolean {
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
export function lumberDestructablesByPreference(
  beliefs: Readonly<CommonBeliefs>,
  peasantOrigin: W3UnitApi.unit,
): readonly HomeDestructable[] {
  const mill = completedLumberMill(beliefs);

  if (!mill) {
    return destructablesAwayFromUnfinishedMill(beliefs);
  }

  const nearestMill = sortByDistanceTo(
    beliefs.destructablesNearHomeByDistance,
    positionOf(beliefs, mill),
  );
  const candidates = sortByDistanceTo(
    nearestMill.slice(0, MILL_TREE_CANDIDATES),
    positionOf(beliefs, peasantOrigin),
  );

  return [...candidates, ...nearestMill.slice(MILL_TREE_CANDIDATES)];
}

function sortByDistanceTo(
  destructables: readonly HomeDestructable[],
  origin: Point,
): HomeDestructable[] {
  return destructables
    .map((destructable) => ({
      destructable,
      distance: new Vector(origin, destructable.position).length,
    }))
    .sort((a, b) => a.distance - b.distance)
    .map((entry) => entry.destructable);
}

// Nearest home first, with those on the far side of the Hall from the mill
// ahead of the rest. Before the mill is placed, simply nearest home.
function destructablesAwayFromUnfinishedMill(
  beliefs: Readonly<CommonBeliefs>,
): readonly HomeDestructable[] {
  const mill = beliefs.lumberMills[0];

  if (!mill) {
    return beliefs.destructablesNearHomeByDistance;
  }

  const hall = beliefs.ownStartPosition;
  const toMill = new Vector(hall, positionOf(beliefs, mill));
  const isAwayFromMill = (destructable: HomeDestructable) =>
    new Vector(hall, destructable.position).dot(toMill) < 0;
  const nearHome = beliefs.destructablesNearHomeByDistance;

  return [
    ...nearHome.filter((destructable) => isAwayFromMill(destructable)),
    ...nearHome.filter((destructable) => !isAwayFromMill(destructable)),
  ];
}
