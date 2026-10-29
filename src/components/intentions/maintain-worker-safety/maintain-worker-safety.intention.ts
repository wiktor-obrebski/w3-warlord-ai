import { ChildFactory, childFactory } from '@lib/bdi';
import type { Random } from '@lib/math';
import type { ActorControl } from '../../../contracts/actor-control';
import type { Beliefs } from '../../../contracts/beliefs';
import type {
  AssembledChildren,
  AssembledWarlordComponent,
  WarlordController,
  WarlordIntention,
  WarlordUpdateChild,
} from '../../../contracts/component';
import type { WarlordDesire } from '../../../contracts/desires';
import type { OrderQueue } from '../../../contracts/orders';
import type { WarcraftProbes } from '../../../contracts/probes';
import type { DecisionRecorder } from '../../../contracts/record';
import { assembleWorkerSafetyController } from './worker-safety.ctrl';

export {
  assembleMaintainWorkerSafetyIntention,
  type MaintainWorkerSafetyCapabilities,
};

interface MaintainWorkerSafetyCapabilities {
  readonly actorControl: ActorControl;
  readonly orders: OrderQueue;
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
  readonly random: Random;
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
            capabilities: {
              actorControl: capabilities.actorControl,
              orders: capabilities.orders,
              probes: capabilities.probes,
              recorder: capabilities.recorder,
              random: capabilities.random,
            },
          }),
      }),
    }),
    children,
  };
}

type WorkerSafetyController = WarlordController;

interface MaintainWorkerSafetyIntentionConstructorArgs {
  createWorkerSafetyController: ChildFactory<WorkerSafetyController>;
}

interface MaintainWorkerSafetyIntentionUpdateArgs {
  beliefs: Beliefs;
  updateChild: WarlordUpdateChild;
}

/** Keeps attacked workers out of harm's way, every bot tick. */
class MaintainWorkerSafetyIntention implements WarlordIntention {
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

  public assessCommitment({ desire }: { desire: WarlordDesire | null }) {
    return desire !== null;
  }
}
