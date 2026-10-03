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

export interface TowerRushContext {
  phase: TowerRushPhase;

  forwardWorkers: W3UnitApi.unit[];
  forwardWorkersSentToEnemy: W3UnitApi.unit[];
  forwardWorkersHoldingPosition: W3UnitApi.unit[];
  forwardWorkersSentToSafety: W3UnitApi.unit[];
  goldWorkers: W3UnitApi.unit[];
  lumberWorkers: W3UnitApi.unit[];
  // Where the Peasant in training is rallied to; undefined when none is.
  trainingPeasantResource: HomeResource | undefined;

  // Build orders whose builder is still busy with them.
  pendingTowerSites: TowerSite[];
  // Repair orders on unfinished towers whose helper is still busy with them.
  towerHelpers: TowerHelper[];
  // Where the rush towers stood when BuildingTowers ended.
  towerPositions: Point[];
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
    goldWorkers: [],
    lumberWorkers: [],
    trainingPeasantResource: undefined,
  };
}
