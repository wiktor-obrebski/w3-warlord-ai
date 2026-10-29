import { ChildFactory, childFactory } from '@lib/bdi';
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
import type { WarcraftProbes } from '../../../contracts/probes';
import type { DecisionRecorder } from '../../../contracts/record';
import { UpdateInterval } from '../update-interval';
import { assembleTowerTargetSelectionController } from './tower-target-selection.ctrl';

export { assembleOperateTowersIntention, type OperateTowersCapabilities };

interface OperateTowersCapabilities {
  readonly actorControl: ActorControl;
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
}

interface AssembleOperateTowersIntentionArgs {
  capabilities: OperateTowersCapabilities;
}

function assembleOperateTowersIntention({
  capabilities,
}: AssembleOperateTowersIntentionArgs): AssembledWarlordComponent<WarlordIntention> {
  const children: AssembledChildren = [];

  return {
    component: new OperateTowersIntention({
      createTargetSelection: childFactory({
        children,
        assemble: () =>
          assembleTowerTargetSelectionController({
            capabilities: {
              actorControl: capabilities.actorControl,
              probes: capabilities.probes,
              recorder: capabilities.recorder,
            },
          }),
      }),
    }),
    children,
  };
}

const UpdateSeconds = 1;

type OperateTowersController = WarlordController;

interface OperateTowersIntentionConstructorArgs {
  createTargetSelection: ChildFactory<OperateTowersController>;
}

interface OperateTowersIntentionUpdateArgs {
  beliefs: Beliefs;
  updateChild: WarlordUpdateChild;
}

/** Directs the fire of the bot's Guard Towers. */
class OperateTowersIntention implements WarlordIntention {
  private readonly interval = new UpdateInterval({ seconds: UpdateSeconds });
  private readonly createTargetSelection: ChildFactory<OperateTowersController>;
  private targetSelection: OperateTowersController | null = null;

  public constructor({
    createTargetSelection,
  }: OperateTowersIntentionConstructorArgs) {
    this.createTargetSelection = createTargetSelection;
  }

  public update({ beliefs, updateChild }: OperateTowersIntentionUpdateArgs) {
    if (this.interval.claim({ now: beliefs.time })) {
      this.targetSelection ??= this.createTargetSelection().component;
      updateChild({ child: this.targetSelection });
    }
  }

  public assessCommitment({ desire }: { desire: WarlordDesire | null }) {
    return desire !== null;
  }
}
