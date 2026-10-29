import * as W3HumanApi from '@lib/warcraft3-api/human';
import type { ActorControl } from '../../../../contracts/actor-control';
import type { UnitId } from '../../../../contracts/ids';
import type { OrderQueue } from '../../../../contracts/orders';
import type { DecisionRecorder } from '../../../../contracts/record';
import { Point, Vector } from '@lib/math';
import type { TowerRushCommonBeliefs } from '../tower-rush.common-beliefs';
import { completedLumberMill, positionOf } from '../tower-rush.assessments';

export { GUARD_TOWER_UPGRADE_GOLD_COST, updateUpgradeTowers };

const GUARD_TOWER_UPGRADE_GOLD_COST = 70;

interface UpdateUpgradeTowersArgs {
  beliefs: Readonly<TowerRushCommonBeliefs>;
  towerPositions: readonly Point[];
  actorControl: ActorControl;
  orders: OrderQueue;
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
  actorControl,
  orders,
  recorder,
}: UpdateUpgradeTowersArgs): { allUpgraded: boolean } {
  const towers = towerPositions.map((position) =>
    plannedTowerAt({ position, beliefs })
  );
  const budget = { gold: beliefs.gold, lumber: beliefs.lumber };

  for (const tower of towers) {
    if (
      tower.unit &&
      tower.towerStatus === TOWER_STATE.SCOUT_TOWER &&
      completedLumberMill({ beliefs }) !== undefined &&
      canAffordGuardTower({ budget }) &&
      actorControl.request({ actor: tower.unit, request: 'normal' })
    ) {
      orderGuardTower({ tower: tower.unit, budget, orders, recorder });
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
  beliefs: Readonly<TowerRushCommonBeliefs>;
}

function plannedTowerAt({
  position,
  beliefs,
}: PlannedTowerAtArgs): PlannedTower {
  const unit = [...beliefs.scoutTowers, ...beliefs.guardTowers].find(
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
  beliefs: Readonly<TowerRushCommonBeliefs>;
}

// Upgrading is checked before the unit type, which may already read as the
// Guard Tower before the upgrade finishes.
function calculateTowerCurrentState({
  tower,
  beliefs,
}: CalculateTowerCurrentStateArgs): TOWER_STATE {
  if (beliefs.buildingsUnderConstruction.includes(tower)) {
    return TOWER_STATE.UNDER_CONSTRUCTION;
  }

  if (beliefs.buildingsUpgrading.includes(tower)) {
    return TOWER_STATE.UPGRADING;
  }

  return beliefs.guardTowers.includes(tower)
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
  orders: OrderQueue;
  recorder: DecisionRecorder;
}

// Believed resources do not reflect orders issued this tick, so the budget
// is reduced locally to avoid ordering upgrades that cannot be paid for. A
// refused upgrade leaves a Scout Tower, which the next update orders again.
function orderGuardTower({
  tower,
  budget,
  orders,
  recorder,
}: OrderGuardTowerArgs) {
  orders.queue({
    order: {
      kind: 'immediateById',
      unit: tower,
      orderId: W3HumanApi.Building.GUARD_TOWER,
      reason: 'Tower rush: Guard Tower upgrade',
    },
  });
  recorder.note({
    message: `Tower rush: Guard Tower upgrade ordered (gold ${budget.gold}, lumber ${budget.lumber}).`,
  });
  budget.gold -= GUARD_TOWER_UPGRADE_GOLD_COST;
  budget.lumber -= GuardTowerUpgradeLumberCost;
}
