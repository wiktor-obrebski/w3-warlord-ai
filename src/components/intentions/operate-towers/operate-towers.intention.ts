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
import { UpdateInterval } from '../update-interval';
import { assembleTowerTargetSelectionController } from './tower-target-selection.ctrl';

export { assembleOperateTowersIntention, type OperateTowersCapabilities };

const UpdateSeconds = 1;

interface OperateTowersCapabilities {
  readonly actorControl: ActorControl;
}

interface OperateTowersIntentionConstructorArgs {
  createTargetSelection: ChildFactory<WarlordController>;
}

interface OperateTowersIntentionUpdateArgs {
  beliefs: WarlordBeliefs;
  updateChild: WarlordUpdateChild;
}

/** Directs the fire of the bot's Guard Towers. */
class OperateTowersIntention implements WarlordIntention {
  private readonly interval = new UpdateInterval({ seconds: UpdateSeconds });
  private readonly createTargetSelection: ChildFactory<WarlordController>;
  private targetSelection: WarlordController | null = null;

  public constructor({
    createTargetSelection,
  }: OperateTowersIntentionConstructorArgs) {
    this.createTargetSelection = createTargetSelection;
  }

  public update({ beliefs, updateChild }: OperateTowersIntentionUpdateArgs) {
    if (this.interval.claim({ now: beliefs.commonBeliefs.time })) {
      this.targetSelection ??= this.createTargetSelection().component;
      updateChild({ child: this.targetSelection });
    }
  }
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
            capabilities: { actorControl: capabilities.actorControl },
          }),
      }),
    }),
    children,
  };
}
