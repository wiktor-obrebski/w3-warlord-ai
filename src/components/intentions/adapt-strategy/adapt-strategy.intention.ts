import type { DesireSupportId } from '@lib/bdi';
import { debug } from '../../../debug';
import type {
  AssembledWarlordComponent,
  WarlordBeliefs,
  WarlordIntention,
} from '../../../contracts/component';
import type {
  WarlordDesire,
  WarlordDesireExpression,
  WarlordDesireOutcome,
} from '../../../contracts/desires';
import type { Strategy } from '../../../contracts/strategy';
import { UpdateInterval } from '../update-interval';
import type { AdaptStrategyCommonBeliefs } from './adapt-strategy.common-beliefs';
import { preferredStrategy } from './adapt-strategy.assessments';

export { assembleAdaptStrategyIntention, type AdaptStrategyCapabilities };

interface AdaptStrategyCapabilities {
  readonly desireExpression: WarlordDesireExpression;
}

interface AssembleAdaptStrategyIntentionArgs {
  capabilities: AdaptStrategyCapabilities;
}

/**
 * Assembles strategy adaptation for a bot whose Common Beliefs are
 * `TCommonBeliefs`, which must provide what adapting the strategy needs to
 * know.
 */
function assembleAdaptStrategyIntention<
  TCommonBeliefs extends AdaptStrategyCommonBeliefs,
>({
  capabilities,
}: AssembleAdaptStrategyIntentionArgs): AssembledWarlordComponent<
  WarlordIntention<TCommonBeliefs>,
  TCommonBeliefs
> {
  return {
    component: new AdaptStrategyIntention({ capabilities }),
    children: [],
  };
}

const UpdateSeconds = 10;
const StrategyImportance = 1;
const ExecuteStrategyOutcomes: Record<Strategy, WarlordDesireOutcome> = {
  TowerRush: { kind: 'ExecuteTowerRushStrategy' },
};

interface AdaptStrategyIntentionConstructorArgs {
  capabilities: AdaptStrategyCapabilities;
}

interface AdaptStrategyIntentionUpdateArgs {
  beliefs: WarlordBeliefs<AdaptStrategyCommonBeliefs>;
}

/**
 * Keeps the bot's strategy effective: periodically assesses which strategy
 * is worth executing and supports the Desire to execute it. It never adopts
 * a strategy itself; Deliberation decides which strategy the bot commits to.
 */
class AdaptStrategyIntention implements WarlordIntention<AdaptStrategyCommonBeliefs> {
  private readonly interval = new UpdateInterval({ seconds: UpdateSeconds });
  private readonly capabilities: AdaptStrategyCapabilities;
  private preferred: Strategy | null = null;
  private supportId: DesireSupportId | null = null;

  public constructor({ capabilities }: AdaptStrategyIntentionConstructorArgs) {
    this.capabilities = capabilities;
  }

  public update({ beliefs }: AdaptStrategyIntentionUpdateArgs) {
    if (!this.interval.claim({ now: beliefs.commonBeliefs.time })) {
      return;
    }

    const preferred = preferredStrategy({ beliefs: beliefs.commonBeliefs });

    if (preferred === this.preferred) {
      if (this.supportId !== null) {
        this.capabilities.desireExpression.support({
          supportId: this.supportId,
        });
      }

      return;
    }

    debug({ message: `Adapt strategy: prefers ${preferred ?? 'none'}.` });
    this.preferred = preferred;
    this.supportPreferred();
  }

  public assessCommitment({ desire }: { desire: WarlordDesire | null }) {
    return desire !== null;
  }

  private supportPreferred() {
    const { desireExpression } = this.capabilities;

    if (this.preferred === null) {
      if (this.supportId !== null) {
        desireExpression.withdraw({ supportId: this.supportId });
      }

      this.supportId = null;
      return;
    }

    const expression = {
      outcome: ExecuteStrategyOutcomes[this.preferred],
      importance: StrategyImportance,
      refreshSeconds: UpdateSeconds,
    };

    this.supportId =
      this.supportId === null
        ? desireExpression.express(expression)
        : desireExpression.replace({
            supportId: this.supportId,
            ...expression,
          });
  }
}
