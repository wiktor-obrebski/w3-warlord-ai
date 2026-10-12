import { ChildFactory, childFactory } from '@lib/bdi';
import {
  ProvidedChildren,
  ProvidedComponent,
  WarlordBeliefs,
  WarlordController,
  WarlordIntention,
  WarlordUpdateChild,
} from '../../execution';
import { provideWorkerSafetyController } from './worker-safety.ctrl';
import { WorkerSafetyBeliefs } from './worker-safety.beliefs';

export { provideMaintainWorkerSafetyIntention };

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
    this.workerSafety ??= this.createWorkerSafetyController().value;
    updateChild({ child: this.workerSafety });
  }
}

function provideMaintainWorkerSafetyIntention(): ProvidedComponent<WarlordIntention> {
  const children: ProvidedChildren = [];

  return {
    value: new MaintainWorkerSafetyIntention({
      createWorkerSafetyController: childFactory({
        children,
        provide: () => provideWorkerSafetyController(),
      }),
    }),
    children,
  };
}
