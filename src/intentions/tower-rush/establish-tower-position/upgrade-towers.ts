import * as W3UnitApi from '@lib/warcraft3-api/unit';
import * as W3HumanApi from '@lib/warcraft3-api/human';
import { debug } from '../../../debug';
import { ActorControl, NORMAL_REQUEST } from '../../../actor';
import { Point, Vector } from '@lib/math';
import { CommonBeliefs } from '../../../beliefs/common.beliefs';
import {
  completedLumberMill,
  positionOf,
} from '../../../beliefs/common.assessments';

export { GUARD_TOWER_UPGRADE_GOLD_COST, updateUpgradeTowers };

const GUARD_TOWER_UPGRADE_GOLD_COST = 70;
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
  unit?: W3UnitApi.unit;
  state: TOWER_STATE;
}

/**
 * Returns whether every rush tower has become a Guard Tower.
 *
 * Each completed Scout Tower is upgraded as soon as the player can afford it,
 * in the order the towers are stored, so a short budget upgrades them one by
 * one without waiting for the others to finish.
 */
function updateUpgradeTowers({
  beliefs,
  towerPositions,
  control,
}: {
  beliefs: Readonly<CommonBeliefs>;
  towerPositions: readonly Point[];
  control: ActorControl;
}): boolean {
  const towers = towerPositions.map((position) =>
    plannedTowerAt({ position, beliefs })
  );
  const budget = { gold: beliefs.gold, lumber: beliefs.lumber };

  for (const tower of towers) {
    if (
      tower.unit &&
      tower.state === TOWER_STATE.SCOUT_TOWER &&
      completedLumberMill({ beliefs }) !== undefined &&
      canAffordGuardTower({ budget }) &&
      control.request({ actor: tower.unit, request: NORMAL_REQUEST })
    ) {
      orderGuardTower({ tower: tower.unit, budget });
    }
  }

  return towers.every((tower) => tower.state === TOWER_STATE.GUARD_TOWER);
}

function plannedTowerAt({
  position,
  beliefs,
}: {
  position: Point;
  beliefs: Readonly<CommonBeliefs>;
}): PlannedTower {
  const unit = [...beliefs.scoutTowers, ...beliefs.guardTowers].find(
    (tower) =>
      new Vector({
        start: position,
        end: positionOf({ beliefs, unit: tower }),
      }).length <= TowerMatchDistance
  );

  return {
    unit,
    state: unit ? towerState({ tower: unit, beliefs }) : TOWER_STATE.MISSING,
  };
}

// Upgrading is checked before the unit type, which may already read as the
// Guard Tower before the upgrade finishes.
function towerState({
  tower,
  beliefs,
}: {
  tower: W3UnitApi.unit;
  beliefs: Readonly<CommonBeliefs>;
}): TOWER_STATE {
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

function canAffordGuardTower({
  budget,
}: {
  budget: { gold: number; lumber: number };
}) {
  return (
    budget.gold >= GUARD_TOWER_UPGRADE_GOLD_COST &&
    budget.lumber >= GuardTowerUpgradeLumberCost
  );
}

// Believed resources do not reflect orders issued this tick, so the budget
// is reduced locally to avoid ordering upgrades that cannot be paid for.
function orderGuardTower({
  tower,
  budget,
}: {
  tower: W3UnitApi.unit;
  budget: { gold: number; lumber: number };
}) {
  if (
    W3UnitApi.IssueImmediateOrderById(tower, W3HumanApi.Building.GUARD_TOWER)
  ) {
    debug({
      message: `Tower rush: Guard Tower upgrade ordered (gold ${budget.gold}, lumber ${budget.lumber}).`,
    });
    budget.gold -= GUARD_TOWER_UPGRADE_GOLD_COST;
    budget.lumber -= GuardTowerUpgradeLumberCost;
  } else {
    debug({ message: 'Tower rush: Guard Tower upgrade order rejected.' });
  }
}
