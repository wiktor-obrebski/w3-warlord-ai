import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { Intention } from "@lib/bdi";
import { GlobalBeliefs } from "../../beliefs/global.beliefs";
import {
  WorkerSafety,
  WorkerSafetyController,
  WorkerSafetyStatus,
} from "./worker-safety.ctrl";

/** Keeps attacked workers out of harm's way, every bot tick. */
export class MaintainWorkerSafetyIntention
  implements Intention<GlobalBeliefs>, WorkerSafety
{
  private readonly workerSafety = new WorkerSafetyController();

  public update(beliefs: Readonly<GlobalBeliefs>) {
    this.workerSafety.update(beliefs);
  }

  public statusOf(worker: W3UnitApi.unit, now: number): WorkerSafetyStatus {
    return this.workerSafety.statusOf(worker, now);
  }
}
