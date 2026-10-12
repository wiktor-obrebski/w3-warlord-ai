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
import { UpdateInterval } from '../update-interval';
import type { OperateTowersCommonBeliefs } from './operate-towers.common-beliefs';
import { assembleTowerTargetSelectionController } from './tower-target-selection.ctrl';

export { assembleOperateTowersIntention, type OperateTowersCapabilities };

interface OperateTowersCapabilities {
  readonly actorControl: ActorControl;
}

interface AssembleOperateTowersIntentionArgs {
  capabilities: OperateTowersCapabilities;
}

/**
 * Assembles tower operation for a bot whose Common Beliefs are
 * `TCommonBeliefs`, which must provide what operating the towers needs to
 * know.
 */
function assembleOperateTowersIntention<
  TCommonBeliefs extends OperateTowersCommonBeliefs,
>({
  capabilities,
}: AssembleOperateTowersIntentionArgs): AssembledWarlordComponent<
  WarlordIntention<TCommonBeliefs>,
  TCommonBeliefs
> {
  const children: AssembledChildren<TCommonBeliefs> = [];

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

const UpdateSeconds = 1;

type OperateTowersController = WarlordController<OperateTowersCommonBeliefs>;

interface OperateTowersIntentionConstructorArgs {
  createTargetSelection: ChildFactory<OperateTowersController>;
}

interface OperateTowersIntentionUpdateArgs {
  beliefs: WarlordBeliefs<OperateTowersCommonBeliefs>;
  updateChild: WarlordUpdateChild<OperateTowersCommonBeliefs>;
}

/** Directs the fire of the bot's Guard Towers. */
class OperateTowersIntention implements WarlordIntention<OperateTowersCommonBeliefs> {
  private readonly interval = new UpdateInterval({ seconds: UpdateSeconds });
  private readonly createTargetSelection: ChildFactory<OperateTowersController>;
  private targetSelection: OperateTowersController | null = null;

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
