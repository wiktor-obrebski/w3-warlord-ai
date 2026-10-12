import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { Point, Vector } from '@lib/math';
import { CommonBeliefs, OwnUnit } from './common.beliefs';

export {
  isRecentlyAttacked,
  recentAttackTarget,
  ownUnit,
  positionOf,
  lifeFractionOf,
  mostDamagedUnit,
  constructionProgress,
  completedLumberMill,
  closestUnit,
};

// Assumed, not verified in-game.
const ConstructionStartLifeFraction = 0.1;

interface IsRecentlyAttackedArgs {
  beliefs: Readonly<CommonBeliefs>;
  target: W3UnitApi.unit;
}

/** Whether any attacker recently started an attack on the bot's unit. */
function isRecentlyAttacked({
  beliefs,
  target,
}: IsRecentlyAttackedArgs): boolean {
  return beliefs.recentAttacks.some((attack) => attack.target === target);
}

interface RecentAttackTargetArgs {
  beliefs: Readonly<CommonBeliefs>;
  attacker: W3UnitApi.unit;
}

/** The bot's unit the attacker recently started an attack on, if any. */
function recentAttackTarget({
  beliefs,
  attacker,
}: RecentAttackTargetArgs): W3UnitApi.unit | undefined {
  return beliefs.recentAttacks.find((attack) => attack.attacker === attacker)
    ?.target;
}

interface OwnUnitArgs {
  beliefs: Readonly<CommonBeliefs>;
  unit: W3UnitApi.unit;
}

/** Throws for a unit not believed to be a living unit of the bot. */
function ownUnit({ beliefs, unit }: OwnUnitArgs): OwnUnit {
  const believed = beliefs.ownUnits.get(unit);

  if (!believed) {
    throw new Error('Beliefs: not a living unit of the bot.');
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
