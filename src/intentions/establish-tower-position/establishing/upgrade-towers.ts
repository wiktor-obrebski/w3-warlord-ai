import * as W3HumanApi from '@lib/warcraft3-api/human';
import type { UnitId } from '../../../contracts/ids';
import type { Directives } from '../../../contracts/directives';
import type { WarlordForce } from '../../../contracts/intentions';
import type { DecisionRecorder } from '../../../contracts/record';
import { Point, Vector } from '@lib/math';
import type { Beliefs } from '../../../contracts/beliefs';
import { completedLumberMill, positionOf } from '../tower-rush.assessments';

export { GUARD_TOWER_UPGRADE_GOLD_COST, updateUpgradeTowers };

const GUARD_TOWER_UPGRADE_GOLD_COST = 70;

interface UpdateUpgradeTowersArgs {
  beliefs: Beliefs;
  towerPositions: readonly Point[];
  force: WarlordForce;
  directives: Directives;
  recorder: DecisionRecorder;
}

/**
 * Returns whether every rush tower has become a Guard Tower (`allUpgraded`).
 *
 * Each completed Scout Tower is upgraded as soon as the player can afford it,
 * in the order the towers are stored, so a short budget upgrades them one by
 * one without waiting for the others to finish.
 */
function updateUpgradeTowers({
  beliefs,
  towerPositions,
  force,
  directives,
  recorder,
}: UpdateUpgradeTowersArgs): { allUpgraded: boolean } {
  const towers = towerPositions.map((position) =>
    plannedTowerAt({ position, beliefs })
  );
  const budget = { gold: beliefs.self.gold, lumber: beliefs.self.lumber };

  for (const tower of towers) {
    if (
      tower.unit &&
      tower.towerStatus === TOWER_STATE.SCOUT_TOWER &&
      completedLumberMill({ beliefs }) !== undefined &&
      canAffordGuardTower({ budget }) &&
      force.units.has(tower.unit)
    ) {
      orderGuardTower({ tower: tower.unit, budget, directives, recorder });
    }
  }

  return {
    allUpgraded: towers.every(
      (tower) => tower.towerStatus === TOWER_STATE.GUARD_TOWER
    ),
  };
}

const GuardTowerUpgradeLumberCost = 50;
// Towers do not move, so their stored position matches closely; rush towers
// stand at least 160 apart.
const TowerMatchDistance = 32;

enum TOWER_STATE {
  MISSING,
  UNDER_CONSTRUCTION,
  SCOUT_TOWER,
  UPGRADING,
  GUARD_TOWER,
}

interface PlannedTower {
  unit?: UnitId;
  towerStatus: TOWER_STATE;
}

interface PlannedTowerAtArgs {
  position: Point;
  beliefs: Beliefs;
}

function plannedTowerAt({
  position,
  beliefs,
}: PlannedTowerAtArgs): PlannedTower {
  const unit = [...beliefs.self.scoutTowers, ...beliefs.self.guardTowers].find(
    (tower) =>
      new Vector({
        start: position,
        end: positionOf({ beliefs, unit: tower }),
      }).length <= TowerMatchDistance
  );

  return {
    unit,
    towerStatus: unit
      ? calculateTowerCurrentState({ tower: unit, beliefs })
      : TOWER_STATE.MISSING,
  };
}

interface CalculateTowerCurrentStateArgs {
  tower: UnitId;
  beliefs: Beliefs;
}

// Upgrading is checked before the unit type, which may already read as the
// Guard Tower before the upgrade finishes.
function calculateTowerCurrentState({
  tower,
  beliefs,
}: CalculateTowerCurrentStateArgs): TOWER_STATE {
  if (beliefs.self.buildingsUnderConstruction.includes(tower)) {
    return TOWER_STATE.UNDER_CONSTRUCTION;
  }

  if (beliefs.self.buildingsUpgrading.includes(tower)) {
    return TOWER_STATE.UPGRADING;
  }

  return beliefs.self.guardTowers.includes(tower)
    ? TOWER_STATE.GUARD_TOWER
    : TOWER_STATE.SCOUT_TOWER;
}

interface CanAffordGuardTowerArgs {
  budget: { gold: number; lumber: number };
}

function canAffordGuardTower({ budget }: CanAffordGuardTowerArgs) {
  return (
    budget.gold >= GUARD_TOWER_UPGRADE_GOLD_COST &&
    budget.lumber >= GuardTowerUpgradeLumberCost
  );
}

interface OrderGuardTowerArgs {
  tower: UnitId;
  budget: { gold: number; lumber: number };
  directives: Directives;
  recorder: DecisionRecorder;
}

// Believed resources do not reflect orders issued this tick, so the budget
// is reduced locally to avoid ordering upgrades that cannot be paid for. A
// refused upgrade leaves a Scout Tower, which the next update orders again.
function orderGuardTower({
  tower,
  budget,
  directives,
  recorder,
}: OrderGuardTowerArgs) {
  directives.give({
    unit: tower,
    task: { kind: 'Produce', unitType: W3HumanApi.Building.GUARD_TOWER },
    reason: 'Tower rush: Guard Tower upgrade',
  });
  recorder.note({
    message: `Tower rush: Guard Tower upgrade ordered (gold ${budget.gold}, lumber ${budget.lumber}).`,
  });
  budget.gold -= GUARD_TOWER_UPGRADE_GOLD_COST;
  budget.lumber -= GuardTowerUpgradeLumberCost;
}
