import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import { debug } from "../../debug";
import { WorldState } from "../../perception/world-state";
import { TowerRushContext } from "./tower-rush-context";

// Warcraft sends Peasants back to harvesting on its own after they finish or
// fail a construction, which would walk the forward workers home. Without the
// harvest ability there is nothing to send them back to. Done only after the
// Militia revert, because morphing may restore the unit type's abilities.
export function removeForwardPeasantsHarvestAbility(
  world: WorldState,
  context: TowerRushContext,
) {
  for (const worker of context.forwardWorkers) {
    if (
      world.peasants.includes(worker) &&
      W3UnitApi.GetUnitAbilityLevel(worker, W3HumanApi.Ability.HARVEST) > 0
    ) {
      W3UnitApi.UnitRemoveAbility(worker, W3HumanApi.Ability.HARVEST);
      debug("Tower rush: harvest ability removed from a forward Peasant.");
    }
  }
}

// Kept as a fallback until removing the harvest ability is confirmed in-game
// to stop Warcraft from sending forward Peasants back to work.
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
