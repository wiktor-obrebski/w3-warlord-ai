import type { DirectiveProgress } from '../../contracts/directives';
import type { UnitId } from '../../contracts/ids';
import type { OrderTarget } from '../../contracts/orders';

export { HOME_RESOURCE, type TowerRushState, createTowerRushState };

enum HOME_RESOURCE {
  GOLD,
  LUMBER,
}

/** Execution state shared by the parts of the tower rush's run. */
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
  // Where the first Peasant in training will go, as the Town Hall's rally.
  peasantRally: OrderTarget | undefined;
  // How the latest Peasant training ordered is going.
  lastPeasantTraining: DirectiveProgress | undefined;
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
    peasantRally: undefined,
    lastPeasantTraining: undefined,
    reservingGoldForUpgrades: false,
  };
}
