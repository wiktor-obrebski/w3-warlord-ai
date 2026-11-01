import { Point, Vector } from '@lib/math';
import type { UnitId } from '../../contracts/ids';
import type { OwnUnit } from '../../contracts/world';
import type { Beliefs } from '../../contracts/beliefs';

export {
  FORWARD_WORKER_COUNT,
  RUSH_TOWER_COUNT,
  allRushTowersBuilt,
  rushTowersAtLeast,
  isAvailableForwardPeasant,
  ownUnit,
  positionOf,
  lifeFractionOf,
  mostDamagedUnit,
  constructionProgress,
  closestUnit,
};

const FORWARD_WORKER_COUNT = 3;
const RUSH_TOWER_COUNT = 3;

interface AllRushTowersBuiltArgs {
  beliefs: Beliefs;
}

/** Whether every rush tower has been placed and finished construction. */
function allRushTowersBuilt({ beliefs }: AllRushTowersBuiltArgs): boolean {
  return (
    beliefs.self.scoutTowers.length >= RUSH_TOWER_COUNT &&
    beliefs.self.scoutTowers.every(
      (tower) => !beliefs.self.buildingsUnderConstruction.includes(tower)
    )
  );
}

interface RushTowersAtLeastArgs {
  beliefs: Beliefs;
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
    beliefs.self.scoutTowers.length >= RUSH_TOWER_COUNT &&
    beliefs.self.scoutTowers.every(
      (tower) => lifeFractionOf({ beliefs, unit: tower }) >= lifeFraction
    )
  );
}

interface IsAvailableForwardPeasantArgs {
  beliefs: Beliefs;
  worker: UnitId;
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
    beliefs.self.peasants.includes(worker) &&
    (beliefs.self.idleUnits.includes(worker) ||
      beliefs.self.holdingPositionUnits.includes(worker) ||
      beliefs.self.harvestingUnits.includes(worker))
  );
}

interface OwnUnitArgs {
  beliefs: Beliefs;
  unit: UnitId;
}

/** Throws for a unit not believed to be a living unit of the bot. */
function ownUnit({ beliefs, unit }: OwnUnitArgs): OwnUnit {
  const believed = beliefs.self.units.get(unit);

  if (!believed) {
    throw new Error('Tower rush: not a living unit of the bot.');
  }

  return believed;
}

interface PositionOfArgs {
  beliefs: Beliefs;
  unit: UnitId;
}

function positionOf({ beliefs, unit }: PositionOfArgs): Point {
  return ownUnit({ beliefs, unit }).position;
}

interface LifeFractionOfArgs {
  beliefs: Beliefs;
  unit: UnitId;
}

function lifeFractionOf({ beliefs, unit }: LifeFractionOfArgs): number {
  const { life, maxLife } = ownUnit({ beliefs, unit });

  return life / maxLife;
}

interface MostDamagedUnitArgs {
  beliefs: Beliefs;
  units: readonly UnitId[];
}

/** Of the bot's units, the one with the lowest life fraction. */
function mostDamagedUnit({
  beliefs,
  units,
}: MostDamagedUnitArgs): UnitId | undefined {
  let mostDamaged: UnitId | undefined;

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
  beliefs: Beliefs;
  building: UnitId;
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

interface ClosestUnitArgs {
  beliefs: Beliefs;
  units: readonly UnitId[];
  to: UnitId;
}

/** Of the bot's units, the one closest to `to`. */
function closestUnit({
  beliefs,
  units,
  to,
}: ClosestUnitArgs): UnitId | undefined {
  const origin = positionOf({ beliefs, unit: to });
  let closest: UnitId | undefined;
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

// Assumed, not verified in-game.
const ConstructionStartLifeFraction = 0.1;
