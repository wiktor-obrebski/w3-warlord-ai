import { ChildFactory, childFactory } from '@lib/bdi';
import type { ActorControl } from '../../../contracts/actor-control';
import type {
  AssembledChildren,
  AssembledWarlordComponent,
  WarlordBeliefs,
  WarlordController,
  WarlordIntention,
  WarlordUpdateChild,
} from '../../../contracts/component';
import type { MaintainWorkerSafetyCommonBeliefs } from './maintain-worker-safety.common-beliefs';
import { assembleWorkerSafetyController } from './worker-safety.ctrl';
import { WorkerSafetyBeliefs } from './worker-safety.beliefs';

export {
  assembleMaintainWorkerSafetyIntention,
  type MaintainWorkerSafetyCapabilities,
};

interface MaintainWorkerSafetyCapabilities {
  readonly actorControl: ActorControl;
}

type WorkerSafetyController = WarlordController<
  MaintainWorkerSafetyCommonBeliefs,
  WorkerSafetyBeliefs
>;

interface MaintainWorkerSafetyIntentionConstructorArgs {
  createWorkerSafetyController: ChildFactory<WorkerSafetyController>;
}

interface MaintainWorkerSafetyIntentionUpdateArgs {
  beliefs: WarlordBeliefs<MaintainWorkerSafetyCommonBeliefs>;
  updateChild: WarlordUpdateChild<MaintainWorkerSafetyCommonBeliefs>;
}

/** Keeps attacked workers out of harm's way, every bot tick. */
class MaintainWorkerSafetyIntention implements WarlordIntention<MaintainWorkerSafetyCommonBeliefs> {
  private readonly createWorkerSafetyController: ChildFactory<WorkerSafetyController>;
  private workerSafety: WorkerSafetyController | null = null;

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

/**
 * Assembles worker safety for a bot whose Common Beliefs are
 * `TCommonBeliefs`, which must provide what worker safety needs to know.
 */
function assembleMaintainWorkerSafetyIntention<
  TCommonBeliefs extends MaintainWorkerSafetyCommonBeliefs,
>({
  capabilities,
}: AssembleMaintainWorkerSafetyIntentionArgs): AssembledWarlordComponent<
  WarlordIntention<TCommonBeliefs>,
  TCommonBeliefs
> {
  const children: AssembledChildren<TCommonBeliefs> = [];

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
