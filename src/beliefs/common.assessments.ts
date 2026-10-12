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

/** Whether any attacker recently started an attack on the bot's unit. */
function isRecentlyAttacked({
  beliefs,
  target,
}: {
  beliefs: Readonly<CommonBeliefs>;
  target: W3UnitApi.unit;
}): boolean {
  return beliefs.recentAttacks.some((attack) => attack.target === target);
}

/** The bot's unit the attacker recently started an attack on, if any. */
function recentAttackTarget({
  beliefs,
  attacker,
}: {
  beliefs: Readonly<CommonBeliefs>;
  attacker: W3UnitApi.unit;
}): W3UnitApi.unit | undefined {
  return beliefs.recentAttacks.find((attack) => attack.attacker === attacker)
    ?.target;
}

/** Throws for a unit not believed to be a living unit of the bot. */
function ownUnit({
  beliefs,
  unit,
}: {
  beliefs: Readonly<CommonBeliefs>;
  unit: W3UnitApi.unit;
}): OwnUnit {
  const believed = beliefs.ownUnits.get(unit);

  if (!believed) {
    throw new Error('Beliefs: not a living unit of the bot.');
  }

  return believed;
}

function positionOf({
  beliefs,
  unit,
}: {
  beliefs: Readonly<CommonBeliefs>;
  unit: W3UnitApi.unit;
}): Point {
  return ownUnit({ beliefs, unit }).position;
}

function lifeFractionOf({
  beliefs,
  unit,
}: {
  beliefs: Readonly<CommonBeliefs>;
  unit: W3UnitApi.unit;
}): number {
  const { life, maxLife } = ownUnit({ beliefs, unit });

  return life / maxLife;
}

/** Of the bot's units, the one with the lowest life fraction. */
function mostDamagedUnit({
  beliefs,
  units,
}: {
  beliefs: Readonly<CommonBeliefs>;
  units: readonly W3UnitApi.unit[];
}): W3UnitApi.unit | undefined {
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

/**
 * Warcraft exposes no construction progress, but a building's life rises
 * linearly from a fraction of its maximum while it is built. A damaged
 * finished building reads as low progress too.
 */
function constructionProgress({
  beliefs,
  building,
}: {
  beliefs: Readonly<CommonBeliefs>;
  building: W3UnitApi.unit;
}): number {
  return (
    (lifeFractionOf({ beliefs, unit: building }) -
      ConstructionStartLifeFraction) /
    (1 - ConstructionStartLifeFraction)
  );
}

function completedLumberMill({
  beliefs,
}: {
  beliefs: Readonly<CommonBeliefs>;
}): W3UnitApi.unit | undefined {
  return beliefs.lumberMills.find(
    (mill) => !beliefs.buildingsUnderConstruction.includes(mill)
  );
}

/** Of the bot's units, the one closest to `to`. */
function closestUnit({
  beliefs,
  units,
  to,
}: {
  beliefs: Readonly<CommonBeliefs>;
  units: readonly W3UnitApi.unit[];
  to: W3UnitApi.unit;
}): W3UnitApi.unit | undefined {
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
