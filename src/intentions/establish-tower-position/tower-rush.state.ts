import type { Directive } from '../../contracts/directives';
import type { UnitId } from '../../contracts/ids';

export { type TowerRushState, createTowerRushState };

/** Execution state shared by the parts of the tower rush's run. */
interface TowerRushState {
  forwardWorkers: UnitId[];
  // Each forward Peasant sent to hide, with the Directive moving it there.
  forwardWorkersSentToSafety: Map<UnitId, Directive>;
  // Once set, the run reserves the money for every Scout Tower that has not
  // started its Guard Tower upgrade, as long as a Lumber Mill stands.
  reservingForUpgrades: boolean;
}

function createTowerRushState(): TowerRushState {
  return {
    forwardWorkers: [],
    forwardWorkersSentToSafety: new Map(),
    reservingForUpgrades: false,
  };
}
