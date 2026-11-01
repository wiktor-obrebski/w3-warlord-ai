import type { DirectiveProgress } from '../../contracts/directives';
import type { UnitId } from '../../contracts/ids';
import type { OrderTarget } from '../../contracts/orders';

export { HOME_RESOURCE, type EconomyState, createEconomyState };

enum HOME_RESOURCE {
  GOLD,
  LUMBER,
}

/** Execution state shared by the parts of the Human economy's run. */
interface EconomyState {
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
  // The bot's units at the previous update, so a Peasant that appears is
  // known to have left training; undefined before the first update.
  knownUnits: ReadonlySet<UnitId> | undefined;
  // Peasants that left training but are not assigned yet, with the resource
  // they were trained for.
  trainedFor: Map<UnitId, HOME_RESOURCE>;
}

function createEconomyState(): EconomyState {
  return {
    goldWorkers: [],
    lumberWorkers: [],
    peasantsInTraining: [],
    peasantTrainingStartedAt: 0,
    peasantRally: undefined,
    lastPeasantTraining: undefined,
    knownUnits: undefined,
    trainedFor: new Map(),
  };
}
