import {
  BeliefContainer,
  Controller,
  Intention,
  UpdateChild,
} from "@lib/bdi";
import { ActorControl } from "../../actor";
import { CommonBeliefModel } from "../../beliefs/common.beliefs";
import { WorkerSafetyController } from "./worker-safety.ctrl";

/** Keeps attacked workers out of harm's way, every bot tick. */
export class MaintainWorkerSafetyIntention
  implements Intention<BeliefContainer, ActorControl>
{
  private readonly workerSafety: WorkerSafetyController;
  private readonly children: readonly Controller<BeliefContainer, ActorControl>[];

  public constructor(common: CommonBeliefModel) {
    this.workerSafety = new WorkerSafetyController(common);
    this.children = [this.workerSafety];
  }

  public activeChildren(): readonly Controller<BeliefContainer, ActorControl>[] {
    return this.children;
  }

  public update(
    _beliefs: Readonly<BeliefContainer>,
    updateChild: UpdateChild<BeliefContainer, ActorControl>,
  ) {
    updateChild(this.workerSafety);
  }
}
