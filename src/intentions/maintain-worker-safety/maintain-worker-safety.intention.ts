import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { BeliefContainer, Controller, Intention } from "@lib/bdi";
import { CommonBeliefModel } from "../../beliefs/common.beliefs";
import {
  WorkerSafety,
  WorkerSafetyController,
  WorkerSafetyStatus,
} from "./worker-safety.ctrl";

/** Keeps attacked workers out of harm's way, every bot tick. */
export class MaintainWorkerSafetyIntention
  implements Intention<BeliefContainer>, WorkerSafety
{
  private readonly workerSafety: WorkerSafetyController;
  private readonly children: readonly Controller<BeliefContainer>[];

  public constructor(common: CommonBeliefModel) {
    this.workerSafety = new WorkerSafetyController(common);
    this.children = [this.workerSafety];
  }

  public activeChildren(): readonly Controller<BeliefContainer>[] {
    return this.children;
  }

  public update(beliefs: Readonly<BeliefContainer>) {
    this.workerSafety.update(beliefs);
  }

  public statusOf(worker: W3UnitApi.unit, now: number): WorkerSafetyStatus {
    return this.workerSafety.statusOf(worker, now);
  }
}
