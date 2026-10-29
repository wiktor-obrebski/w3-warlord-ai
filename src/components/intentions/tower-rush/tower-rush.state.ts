import type { UnitId } from '../../../contracts/ids';

export { HOME_RESOURCE, type TowerRushState, createTowerRushState };

enum HOME_RESOURCE {
  GOLD,
  LUMBER,
}

/** Execution state shared by the tower rush's Plan and Controllers. */
interface TowerRushState {
  forwardWorkers: UnitId[];
  forwardWorkersSentToSafety: UnitId[];
  goldWorkers: UnitId[];
  lumberWorkers: UnitId[];
  // The resource of each Peasant ordered at the Town Hall, in training order;
  // the first one is in training.
  peasantsInTraining: HOME_RESOURCE[];
  // When the first Peasant in training started training.
  peasantTrainingStartedAt: number;
  // Once set, Peasant production leaves gold for every Scout Tower that has
  // not started its Guard Tower upgrade.
  reservingGoldForUpgrades: boolean;
}

function createTowerRushState(): TowerRushState {
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
