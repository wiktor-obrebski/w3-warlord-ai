import * as W3UnitApi from "@lib/warcraft3-api/unit";
import {
  BeliefContainer,
  Controller,
  Intention,
  UpdateChild,
} from "@lib/bdi";
import { Actor } from "../../actor";
import { CommonBeliefModel } from "../../beliefs/common.beliefs";
import {
  WorkerSafety,
  WorkerSafetyController,
  WorkerSafetyStatus,
} from "./worker-safety.ctrl";

/** Keeps attacked workers out of harm's way, every bot tick. */
export class MaintainWorkerSafetyIntention
  implements Intention<BeliefContainer, Actor>, WorkerSafety
{
  private readonly workerSafety: WorkerSafetyController;
  private readonly children: readonly Controller<BeliefContainer, Actor>[];

  public constructor(common: CommonBeliefModel) {
    this.workerSafety = new WorkerSafetyController(common);
    this.children = [this.workerSafety];
  }

  public activeChildren(): readonly Controller<BeliefContainer, Actor>[] {
    return this.children;
  }

  public update(
    _beliefs: Readonly<BeliefContainer>,
    updateChild: UpdateChild<BeliefContainer, Actor>,
  ) {
    updateChild(this.workerSafety);
  }

  public statusOf(
    worker: W3UnitApi.unit,
    beliefs: Readonly<BeliefContainer>,
  ): WorkerSafetyStatus {
    return this.workerSafety.statusOf(worker, beliefs);
  }
}
