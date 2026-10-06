import { Intention } from "@lib/bdi";
import { GlobalBeliefs } from "../../beliefs/global.beliefs";
import { UpdateInterval } from "../update-interval";
import { TowerTargetSelectionController } from "./tower-target-selection.ctrl";

const UPDATE_SECONDS = 1;

/** Directs the fire of the bot's Guard Towers. */
export class OperateTowersIntention implements Intention<GlobalBeliefs> {
  private readonly interval = new UpdateInterval(UPDATE_SECONDS);
  private readonly targetSelection = new TowerTargetSelectionController();

  public update(beliefs: Readonly<GlobalBeliefs>) {
    if (this.interval.claim(beliefs.time)) {
      this.targetSelection.update(beliefs);
    }
  }
}
