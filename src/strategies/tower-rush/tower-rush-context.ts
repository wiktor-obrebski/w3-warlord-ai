import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { Point } from "../../perception/world-state";

export enum TowerRushPhase {
  Start,
  MovingToEnemy,
  BuildingTowers,
  UpgradingTowers,
}

export interface TowerSite {
  builder: W3UnitApi.unit;
  position: Point;
}

export interface TowerRushContext {
  phase: TowerRushPhase;

  forwardWorkers: W3UnitApi.unit[];
  forwardWorkersSentToEnemy: W3UnitApi.unit[];
  forwardWorkersHoldingPosition: W3UnitApi.unit[];
  goldWorkers: W3UnitApi.unit[];
  lumberWorkers: W3UnitApi.unit[];
  peasantInTraining: boolean;

  // Build orders whose builder is still busy with them.
  pendingTowerSites: TowerSite[];
}

export function createTowerRushContext(): TowerRushContext {
  return {
    phase: TowerRushPhase.Start,
    forwardWorkers: [],
    forwardWorkersSentToEnemy: [],
    forwardWorkersHoldingPosition: [],
    pendingTowerSites: [],
    goldWorkers: [],
    lumberWorkers: [],
    peasantInTraining: false,
  };
}
