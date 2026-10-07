import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../../debug";
import { Point, Vector } from "@lib/math";
import { CommonBeliefs, positionOf } from "../../../beliefs/common.beliefs";

export const GUARD_TOWER_UPGRADE_GOLD_COST = 70;
const GUARD_TOWER_UPGRADE_LUMBER_COST = 50;
// Towers do not move, so their stored position matches closely; rush towers
// stand at least 160 apart.
const TOWER_MATCH_DISTANCE = 32;

enum TowerState {
  Missing,
  UnderConstruction,
  ScoutTower,
  Upgrading,
  GuardTower,
}

interface PlannedTower {
  unit?: W3UnitApi.unit;
  state: TowerState;
}

/**
 * Returns whether every rush tower has become a Guard Tower.
 *
 * Each completed Scout Tower is upgraded as soon as the player can afford it,
 * in the order the towers are stored, so a short budget upgrades them one by
 * one without waiting for the others to finish.
 */
export function updateUpgradeTowers(
  beliefs: Readonly<CommonBeliefs>,
  towerPositions: readonly Point[],
): boolean {
  const towers = towerPositions.map((position) =>
    plannedTowerAt(position, beliefs),
  );
  const budget = { gold: beliefs.gold, lumber: beliefs.lumber };

  for (const tower of towers) {
    if (
      tower.unit &&
      tower.state === TowerState.ScoutTower &&
      hasCompletedLumberMill(beliefs) &&
      canAffordGuardTower(budget)
    ) {
      orderGuardTower(tower.unit, budget);
    }
  }

  return towers.every((tower) => tower.state === TowerState.GuardTower);
}

function plannedTowerAt(
  position: Point,
  beliefs: Readonly<CommonBeliefs>,
): PlannedTower {
  const unit = [...beliefs.scoutTowers, ...beliefs.guardTowers].find(
    (tower) =>
      new Vector(position, positionOf(beliefs, tower)).length <=
      TOWER_MATCH_DISTANCE,
  );

  return { unit, state: unit ? towerState(unit, beliefs) : TowerState.Missing };
}

// Upgrading is checked before the unit type, which may already read as the
// Guard Tower before the upgrade finishes.
function towerState(
  tower: W3UnitApi.unit,
  beliefs: Readonly<CommonBeliefs>,
): TowerState {
  if (beliefs.buildingsUnderConstruction.includes(tower)) {
    return TowerState.UnderConstruction;
  }

  if (beliefs.buildingsUpgrading.includes(tower)) {
    return TowerState.Upgrading;
  }

  return beliefs.guardTowers.includes(tower)
    ? TowerState.GuardTower
    : TowerState.ScoutTower;
}

function hasCompletedLumberMill(beliefs: Readonly<CommonBeliefs>): boolean {
  return beliefs.lumberMills.some(
    (mill) => !beliefs.buildingsUnderConstruction.includes(mill),
  );
}

function canAffordGuardTower(budget: { gold: number; lumber: number }) {
  return (
    budget.gold >= GUARD_TOWER_UPGRADE_GOLD_COST &&
    budget.lumber >= GUARD_TOWER_UPGRADE_LUMBER_COST
  );
}

// Believed resources do not reflect orders issued this tick, so the budget
// is reduced locally to avoid ordering upgrades that cannot be paid for.
function orderGuardTower(
  tower: W3UnitApi.unit,
  budget: { gold: number; lumber: number },
) {
  if (
    W3UnitApi.IssueImmediateOrderById(tower, W3HumanApi.Building.GUARD_TOWER)
  ) {
    debug(
      `Tower rush: Guard Tower upgrade ordered (gold ${budget.gold}, lumber ${budget.lumber}).`,
    );
    budget.gold -= GUARD_TOWER_UPGRADE_GOLD_COST;
    budget.lumber -= GUARD_TOWER_UPGRADE_LUMBER_COST;
  } else {
    debug("Tower rush: Guard Tower upgrade order rejected.");
  }
}
