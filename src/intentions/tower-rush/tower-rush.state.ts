import * as W3UnitApi from "@lib/warcraft3-api/unit";

export enum HomeResource {
  Gold,
  Lumber,
}

/** Execution state shared by the tower rush's Plan and Controllers. */
export interface TowerRushState {
  forwardWorkers: W3UnitApi.unit[];
  forwardWorkersSentToSafety: W3UnitApi.unit[];
  goldWorkers: W3UnitApi.unit[];
  lumberWorkers: W3UnitApi.unit[];
  // The resource of each Peasant ordered at the Town Hall, in training order;
  // the first one is in training.
  peasantsInTraining: HomeResource[];
  // When the first Peasant in training started training.
  peasantTrainingStartedAt: number;
  // Once set, Peasant production leaves gold for every Scout Tower that has
  // not started its Guard Tower upgrade.
  reservingGoldForUpgrades: boolean;
}

export function createTowerRushState(): TowerRushState {
  return {
    forwardWorkers: [],
    forwardWorkersSentToSafety: [],
    goldWorkers: [],
    lumberWorkers: [],
    peasantsInTraining: [],
    peasantTrainingStartedAt: 0,
    reservingGoldForUpgrades: false,
  };
}
