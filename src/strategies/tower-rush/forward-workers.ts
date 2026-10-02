import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../debug";
import { WorldState } from "../../perception/world-state";
import { TowerRushContext } from "./tower-rush-context";

// Observed: Warcraft itself sends the bot's Peasants back to harvesting after
// they finish or fail a construction, which would walk the forward workers
// home. Holding them is gentler than removing their harvest ability.
export function holdForwardWorkersSentBackToWork(
  world: WorldState,
  context: TowerRushContext,
) {
  for (const worker of context.forwardWorkers) {
    if (
      world.peasants.includes(worker) &&
      world.harvestingUnits.includes(worker)
    ) {
      if (W3UnitApi.IssueImmediateOrder(worker, "holdposition")) {
        debug("Tower rush: forward Peasant sent back to work; holding it.");
      } else {
        debug("Tower rush: hold position order rejected.");
      }
    }
  }
}
