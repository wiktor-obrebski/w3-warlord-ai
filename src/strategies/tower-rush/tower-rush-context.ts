import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { Point } from "../../perception/world-state";

export enum TowerRushPhase {
  Start,
  MovingToEnemy,
  BuildingTowers,
}

export interface TowerRushContext {
  phase: TowerRushPhase;

  forwardWorkers: W3UnitApi.unit[];
  forwardWorkersSentToEnemy: W3UnitApi.unit[];
  goldWorkers: W3UnitApi.unit[];
  lumberWorkers: W3UnitApi.unit[];
  peasantInTraining: boolean;

  enemyMainPosition?: Point;
}

export function createTowerRushContext(): TowerRushContext {
  return {
    phase: TowerRushPhase.Start,
    forwardWorkers: [],
    forwardWorkersSentToEnemy: [],
    goldWorkers: [],
    lumberWorkers: [],
    peasantInTraining: false,
  };
}
