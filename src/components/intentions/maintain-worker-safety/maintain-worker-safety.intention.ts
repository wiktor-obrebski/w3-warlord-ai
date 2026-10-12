import { ChildFactory, childFactory } from '@lib/bdi';
import type { ActorControl } from '../../../contracts/actor-control';
import {
  AssembledChildren,
  AssembledWarlordComponent,
  WarlordBeliefs,
  WarlordController,
  WarlordIntention,
  WarlordUpdateChild,
} from '../../../execution';
import { assembleWorkerSafetyController } from './worker-safety.ctrl';
import { WorkerSafetyBeliefs } from './worker-safety.beliefs';

export {
  assembleMaintainWorkerSafetyIntention,
  type MaintainWorkerSafetyCapabilities,
};

interface MaintainWorkerSafetyCapabilities {
  readonly actorControl: ActorControl;
}

interface MaintainWorkerSafetyIntentionConstructorArgs {
  createWorkerSafetyController: ChildFactory<
    WarlordController<WorkerSafetyBeliefs>
  >;
}

interface MaintainWorkerSafetyIntentionUpdateArgs {
  beliefs: WarlordBeliefs;
  updateChild: WarlordUpdateChild;
}

/** Keeps attacked workers out of harm's way, every bot tick. */
class MaintainWorkerSafetyIntention implements WarlordIntention {
  private readonly createWorkerSafetyController: ChildFactory<
    WarlordController<WorkerSafetyBeliefs>
  >;
  private workerSafety: WarlordController<WorkerSafetyBeliefs> | null = null;

  public constructor({
    createWorkerSafetyController,
  }: MaintainWorkerSafetyIntentionConstructorArgs) {
    this.createWorkerSafetyController = createWorkerSafetyController;
  }

  public update({ updateChild }: MaintainWorkerSafetyIntentionUpdateArgs) {
    this.workerSafety ??= this.createWorkerSafetyController().component;
    updateChild({ child: this.workerSafety });
  }
}

interface AssembleMaintainWorkerSafetyIntentionArgs {
  capabilities: MaintainWorkerSafetyCapabilities;
}

function assembleMaintainWorkerSafetyIntention({
  capabilities,
}: AssembleMaintainWorkerSafetyIntentionArgs): AssembledWarlordComponent<WarlordIntention> {
  const children: AssembledChildren = [];

  return {
    component: new MaintainWorkerSafetyIntention({
      createWorkerSafetyController: childFactory({
        children,
        assemble: () =>
          assembleWorkerSafetyController({
            capabilities: { actorControl: capabilities.actorControl },
          }),
      }),
    }),
    children,
  };
}
