import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../debug";
import { WorldState } from "../../perception/world-state";
import { TowerRushContext } from "./tower-rush-context";

// Forward Peasants have been seen walking home to harvest. It is not yet
// known whether Warcraft or our home economy sends them; the handle id in the
// log is matched against the home economy's identity log to find out.
export function holdForwardWorkersSentBackToWork(
  world: WorldState,
  context: TowerRushContext,
) {
  for (const worker of context.forwardWorkers) {
    if (
      world.peasants.includes(worker) &&
      world.harvestingUnits.includes(worker)
    ) {
      const harvestOrder = W3UnitApi.GetUnitCurrentOrder(worker);

      if (W3UnitApi.IssueImmediateOrder(worker, "holdposition")) {
        debug(
          `Tower rush: forward Peasant id ${W3UnitApi.GetHandleId(worker)} was harvesting (order ${harvestOrder}); holding it.`,
        );
      } else {
        debug("Tower rush: hold position order rejected.");
      }
    }
  }
}
