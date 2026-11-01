import type { UnitId } from '../../contracts/ids';

export { type TowerRushState, createTowerRushState };

/** Execution state shared by the parts of the tower rush's run. */
interface TowerRushState {
  forwardWorkers: UnitId[];
  forwardWorkersSentToSafety: UnitId[];
  // Once set, the run reserves the money for every Scout Tower that has not
  // started its Guard Tower upgrade.
  reservingForUpgrades: boolean;
}

function createTowerRushState(): TowerRushState {
  return {
    forwardWorkers: [],
    forwardWorkersSentToSafety: [],
    reservingForUpgrades: false,
  };
}
