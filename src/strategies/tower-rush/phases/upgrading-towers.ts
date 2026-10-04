import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../../debug";
import { Point, WorldState } from "../../../perception/world-state";
import { TowerRushContext, TowerRushPhase } from "../tower-rush-context";
import { maintainTowers } from "../tower-repair";
import { WorkerSafety } from "../../../capabilities/worker-safety/worker-safety";

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

// Each completed Scout Tower is upgraded as soon as the player can afford it,
// in the order the towers are stored, so a short budget upgrades them one by
// one without waiting for the others to finish. The enemy may already attack
// the towers, so they are repaired meanwhile.
export function updateUpgradingTowers(
  world: WorldState,
  context: TowerRushContext,
  workerSafety: WorkerSafety,
) {
  maintainTowers(world, context, workerSafety);

  const towers = context.towerPositions.map((position) =>
    plannedTowerAt(position, world),
  );
  const budget = { gold: world.gold, lumber: world.lumber };

  for (const tower of towers) {
    if (
      tower.unit &&
      tower.state === TowerState.ScoutTower &&
      hasCompletedLumberMill(world) &&
      canAffordGuardTower(budget)
    ) {
      orderGuardTower(tower.unit, budget);
    }
  }

  if (towers.every((tower) => tower.state === TowerState.GuardTower)) {
    context.phase = TowerRushPhase.HoldingPosition;
  }
}

function plannedTowerAt(position: Point, world: WorldState): PlannedTower {
  const unit = [...world.scoutTowers, ...world.guardTowers].find(
    (tower) =>
      distanceBetween(position, positionOf(tower)) <= TOWER_MATCH_DISTANCE,
  );

  return { unit, state: unit ? towerState(unit, world) : TowerState.Missing };
}

// Upgrading is checked before the unit type, which may already read as the
// Guard Tower before the upgrade finishes.
function towerState(tower: W3UnitApi.unit, world: WorldState): TowerState {
  if (world.buildingsUnderConstruction.includes(tower)) {
    return TowerState.UnderConstruction;
  }

  if (world.buildingsUpgrading.includes(tower)) {
    return TowerState.Upgrading;
  }

  return world.guardTowers.includes(tower)
    ? TowerState.GuardTower
    : TowerState.ScoutTower;
}

function hasCompletedLumberMill(world: WorldState): boolean {
  return world.lumberMills.some(
    (mill) => !world.buildingsUnderConstruction.includes(mill),
  );
}

function canAffordGuardTower(budget: { gold: number; lumber: number }) {
  return (
    budget.gold >= GUARD_TOWER_UPGRADE_GOLD_COST &&
    budget.lumber >= GUARD_TOWER_UPGRADE_LUMBER_COST
  );
}

// Perceived resources do not reflect orders issued this tick, so the budget
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

function positionOf(unit: W3UnitApi.unit): Point {
  return { x: W3UnitApi.GetUnitX(unit), y: W3UnitApi.GetUnitY(unit) };
}

function distanceBetween(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
