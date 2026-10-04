import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { Point } from "../../perception/world-state";

export enum TowerRushPhase {
  Start,
  MovingToEnemy,
  BuildingTowers,
  UpgradingTowers,
  HoldingPosition,
}

export enum HomeResource {
  Gold,
  Lumber,
}

export interface TowerSite {
  builder: W3UnitApi.unit;
  position: Point;
}

export interface TowerHelper {
  helper: W3UnitApi.unit;
  tower: W3UnitApi.unit;
}

export interface TowerTarget {
  tower: W3UnitApi.unit;
  target: W3UnitApi.unit;
}

export interface TowerRushContext {
  phase: TowerRushPhase;

  forwardWorkers: W3UnitApi.unit[];
  forwardWorkersSentToEnemy: W3UnitApi.unit[];
  forwardWorkersHoldingPosition: W3UnitApi.unit[];
  forwardWorkersSentToSafety: W3UnitApi.unit[];
  goldWorkers: W3UnitApi.unit[];
  lumberWorkers: W3UnitApi.unit[];
  // Lumber workers seen carrying lumber back on the last update.
  lumberWorkersReturning: W3UnitApi.unit[];
  // Lumber workers already sent to the trees by the finished Lumber Mill.
  lumberWorkersAtMill: W3UnitApi.unit[];
  // The resource of each Peasant ordered at the Town Hall, in training order;
  // the first one is in training.
  peasantsInTraining: HomeResource[];
  // When the first Peasant in training started training.
  peasantTrainingStartedAt: number;
  // Once set, Peasant production leaves gold for every Scout Tower that has
  // not started its Guard Tower upgrade.
  reservingGoldForUpgrades: boolean;

  // Build orders whose builder is still busy with them.
  pendingTowerSites: TowerSite[];
  // Repair orders on unfinished towers whose helper is still busy with them.
  towerHelpers: TowerHelper[];
  // Where the rush towers stood when BuildingTowers ended.
  towerPositions: Point[];

  // The tower the forward Peasants are repairing.
  repairTarget?: W3UnitApi.unit;
  // The last attack order of each Guard Tower, so it is not re-issued while
  // the tower is still carrying it out.
  towerTargets: TowerTarget[];
}

export function createTowerRushContext(): TowerRushContext {
  return {
    phase: TowerRushPhase.Start,
    forwardWorkers: [],
    forwardWorkersSentToEnemy: [],
    forwardWorkersHoldingPosition: [],
    forwardWorkersSentToSafety: [],
    pendingTowerSites: [],
    towerHelpers: [],
    towerPositions: [],
    towerTargets: [],
    goldWorkers: [],
    lumberWorkers: [],
    lumberWorkersReturning: [],
    lumberWorkersAtMill: [],
    peasantsInTraining: [],
    peasantTrainingStartedAt: 0,
    reservingGoldForUpgrades: false,
  };
}
