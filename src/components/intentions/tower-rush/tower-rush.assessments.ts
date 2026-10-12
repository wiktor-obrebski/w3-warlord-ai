import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { Point, Vector } from '@lib/math';
import type { HomeDestructable, OwnUnit } from '../../../contracts/world';
import { CommonBeliefs } from '../../../beliefs/common.beliefs';

export {
  RUSH_TOWER_COUNT,
  allRushTowersBuilt,
  rushTowersAtLeast,
  isAvailableForwardPeasant,
  lumberDestructablesByPreference,
  ownUnit,
  positionOf,
  lifeFractionOf,
  mostDamagedUnit,
  constructionProgress,
  completedLumberMill,
  closestUnit,
};

const RUSH_TOWER_COUNT = 3;
const MillTreeCandidates = 4;
// Assumed, not verified in-game.
const ConstructionStartLifeFraction = 0.1;

interface AllRushTowersBuiltArgs {
  beliefs: Readonly<CommonBeliefs>;
}

/** Whether every rush tower has been placed and finished construction. */
function allRushTowersBuilt({ beliefs }: AllRushTowersBuiltArgs): boolean {
  return (
    beliefs.scoutTowers.length >= RUSH_TOWER_COUNT &&
    beliefs.scoutTowers.every(
      (tower) => !beliefs.buildingsUnderConstruction.includes(tower)
    )
  );
}

interface RushTowersAtLeastArgs {
  beliefs: Readonly<CommonBeliefs>;
  lifeFraction: number;
}

/**
 * Whether every rush tower has been placed and stands at or above the life
 * fraction; during construction this tracks build progress.
 */
function rushTowersAtLeast({
  beliefs,
  lifeFraction,
}: RushTowersAtLeastArgs): boolean {
  return (
    beliefs.scoutTowers.length >= RUSH_TOWER_COUNT &&
    beliefs.scoutTowers.every(
      (tower) => lifeFractionOf({ beliefs, unit: tower }) >= lifeFraction
    )
  );
}

interface IsAvailableForwardPeasantArgs {
  beliefs: Readonly<CommonBeliefs>;
  worker: W3UnitApi.unit;
}

/**
 * Whether the forward Peasant is free for a new order: idle, holding, or
 * sent back to harvesting. Anything else means it is busy with an order of
 * its own, such as building or repairing.
 */
function isAvailableForwardPeasant({
  beliefs,
  worker,
}: IsAvailableForwardPeasantArgs): boolean {
  return (
    beliefs.peasants.includes(worker) &&
    (beliefs.idleUnits.includes(worker) ||
      beliefs.holdingPositionUnits.includes(worker) ||
      beliefs.harvestingUnits.includes(worker))
  );
}

interface LumberDestructablesByPreferenceArgs {
  beliefs: Readonly<CommonBeliefs>;
  peasantOrigin: W3UnitApi.unit;
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
    destructables: beliefs.destructablesNearHomeByDistance,
    origin: positionOf({ beliefs, unit: mill }),
  });
  const candidates = sortByDistanceTo({
    destructables: nearestMill.slice(0, MillTreeCandidates),
    origin: positionOf({ beliefs, unit: peasantOrigin }),
  });

  return [...candidates, ...nearestMill.slice(MillTreeCandidates)];
}

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
  beliefs: Readonly<CommonBeliefs>;
}

// Nearest home first, with those on the far side of the Hall from the mill
// ahead of the rest. Before the mill is placed, simply nearest home.
function destructablesAwayFromUnfinishedMill({
  beliefs,
}: DestructablesAwayFromUnfinishedMillArgs): readonly HomeDestructable[] {
  const mill = beliefs.lumberMills[0];

  if (!mill) {
    return beliefs.destructablesNearHomeByDistance;
  }

  const hall = beliefs.ownStartPosition;
  const toMill = new Vector({
    start: hall,
    end: positionOf({ beliefs, unit: mill }),
  });
  const isAwayFromMill = ({ destructable }: IsAwayFromMillArgs) =>
    new Vector({ start: hall, end: destructable.position }).dot({
      vector: toMill,
    }) < 0;
  const nearHome = beliefs.destructablesNearHomeByDistance;

  return [
    ...nearHome.filter((destructable) => isAwayFromMill({ destructable })),
    ...nearHome.filter((destructable) => !isAwayFromMill({ destructable })),
  ];
}

interface OwnUnitArgs {
  beliefs: Readonly<CommonBeliefs>;
  unit: W3UnitApi.unit;
}

/** Throws for a unit not believed to be a living unit of the bot. */
function ownUnit({ beliefs, unit }: OwnUnitArgs): OwnUnit {
  const believed = beliefs.ownUnits.get(unit);

  if (!believed) {
    throw new Error('Tower rush: not a living unit of the bot.');
  }

  return believed;
}

interface PositionOfArgs {
  beliefs: Readonly<CommonBeliefs>;
  unit: W3UnitApi.unit;
}

function positionOf({ beliefs, unit }: PositionOfArgs): Point {
  return ownUnit({ beliefs, unit }).position;
}

interface LifeFractionOfArgs {
  beliefs: Readonly<CommonBeliefs>;
  unit: W3UnitApi.unit;
}

function lifeFractionOf({ beliefs, unit }: LifeFractionOfArgs): number {
  const { life, maxLife } = ownUnit({ beliefs, unit });

  return life / maxLife;
}

interface MostDamagedUnitArgs {
  beliefs: Readonly<CommonBeliefs>;
  units: readonly W3UnitApi.unit[];
}

/** Of the bot's units, the one with the lowest life fraction. */
function mostDamagedUnit({
  beliefs,
  units,
}: MostDamagedUnitArgs): W3UnitApi.unit | undefined {
  let mostDamaged: W3UnitApi.unit | undefined;

  for (const unit of units) {
    if (
      !mostDamaged ||
      lifeFractionOf({ beliefs, unit }) <
        lifeFractionOf({ beliefs, unit: mostDamaged })
    ) {
      mostDamaged = unit;
    }
  }

  return mostDamaged;
}

interface ConstructionProgressArgs {
  beliefs: Readonly<CommonBeliefs>;
  building: W3UnitApi.unit;
}

/**
 * Warcraft exposes no construction progress, but a building's life rises
 * linearly from a fraction of its maximum while it is built. A damaged
 * finished building reads as low progress too.
 */
function constructionProgress({
  beliefs,
  building,
}: ConstructionProgressArgs): number {
  return (
    (lifeFractionOf({ beliefs, unit: building }) -
      ConstructionStartLifeFraction) /
    (1 - ConstructionStartLifeFraction)
  );
}

interface CompletedLumberMillArgs {
  beliefs: Readonly<CommonBeliefs>;
}

function completedLumberMill({
  beliefs,
}: CompletedLumberMillArgs): W3UnitApi.unit | undefined {
  return beliefs.lumberMills.find(
    (mill) => !beliefs.buildingsUnderConstruction.includes(mill)
  );
}

interface ClosestUnitArgs {
  beliefs: Readonly<CommonBeliefs>;
  units: readonly W3UnitApi.unit[];
  to: W3UnitApi.unit;
}

/** Of the bot's units, the one closest to `to`. */
function closestUnit({
  beliefs,
  units,
  to,
}: ClosestUnitArgs): W3UnitApi.unit | undefined {
  const origin = positionOf({ beliefs, unit: to });
  let closest: W3UnitApi.unit | undefined;
  let closestDistance = Infinity;

  for (const unit of units) {
    const distance = new Vector({
      start: origin,
      end: positionOf({ beliefs, unit }),
    }).length;

    if (distance < closestDistance) {
      closest = unit;
      closestDistance = distance;
    }
  }

  return closest;
}
