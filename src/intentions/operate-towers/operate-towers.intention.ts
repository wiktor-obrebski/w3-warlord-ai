import {
  BeliefContainer,
  Controller,
  Intention,
  UpdateChild,
} from "@lib/bdi";
import { ActorControl } from "../../actor";
import { CommonBeliefModel } from "../../beliefs/common.beliefs";
import { UpdateInterval } from "../update-interval";
import { TowerTargetSelectionController } from "./tower-target-selection.ctrl";

const UPDATE_SECONDS = 1;

/** Directs the fire of the bot's Guard Towers. */
export class OperateTowersIntention
  implements Intention<BeliefContainer, ActorControl>
{
  private readonly common: CommonBeliefModel;
  private readonly interval = new UpdateInterval(UPDATE_SECONDS);
  private readonly targetSelection: TowerTargetSelectionController;
  private readonly children: readonly Controller<BeliefContainer, ActorControl>[];

  public constructor(common: CommonBeliefModel) {
    this.common = common;
    this.targetSelection = new TowerTargetSelectionController(common);
    this.children = [this.targetSelection];
  }

  public activeChildren(): readonly Controller<BeliefContainer, ActorControl>[] {
    return this.children;
  }

  public update(
    beliefs: Readonly<BeliefContainer>,
    updateChild: UpdateChild<BeliefContainer, ActorControl>,
  ) {
    if (this.interval.claim(beliefs.get(this.common).time)) {
      updateChild(this.targetSelection);
    }
  }
}
