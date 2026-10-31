import { Deliberation } from '@lib/bdi';
import type { Random } from '@lib/math';
import type { Beliefs } from '../contracts/beliefs';
import type {
  AssembledWarlordComponent,
  WarlordIntention,
} from '../contracts/component';
import type {
  WarlordDesire,
  WarlordDesireExpression,
  WarlordDesireOutcome,
} from '../contracts/desires';
import type { ActorControl } from '../contracts/actor-control';
import type { OrderQueue } from '../contracts/orders';
import type { WarcraftProbes } from '../contracts/probes';
import type { DecisionRecorder } from '../contracts/record';
import {
  assembleAdaptStrategyIntention,
  AdaptStrategyCapabilities,
} from '../components/intentions/adapt-strategy/adapt-strategy.api';
import {
  assembleTowerRushIntention,
  TowerRushCapabilities,
  TowerRushIntention,
} from '../components/intentions/tower-rush/tower-rush.api';
import {
  assembleOperateTowersIntention,
  OperateTowersCapabilities,
} from '../components/intentions/operate-towers/operate-towers.api';

export { type AssembledIntention, createDeliberation };

/** An Intention as its assemble function builds it. */
type AssembledIntention = AssembledWarlordComponent<WarlordIntention>;

interface CreateDeliberationArgs {
  actorControl: ActorControl;
  desireExpression: WarlordDesireExpression;
  orders: OrderQueue;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
  random: Random;
}

/**
 * A fixed policy for now, adopting one Intention for each Desire:
 *
 * - MaintainEffectiveStrategy → AdaptStrategy
 * - ExecuteTowerRushStrategy → TowerRush, the bot's strategy commitment
 * - UseMilitaryAssetsEffectively → OperateTowers, once the tower rush has
 *   established its Guard Tower position
 *
 * A retained Intention is kept for as long as it assesses its commitment as
 * still worthwhile, even if its Desire is gone, and dropped otherwise.
 *
 * Intentions are returned in update order. Deliberation remembers the
 * Intentions it assembled, so it can tell them apart and read their state.
 */
function createDeliberation({
  actorControl,
  desireExpression,
  orders,
  probes,
  recorder,
  random,
}: CreateDeliberationArgs): Deliberation<
  Beliefs,
  WarlordDesire,
  AssembledIntention
> {
  const adaptStrategyCapabilitiesProvider: AdaptStrategyCapabilities = {
    desireExpression,
    recorder,
  };
  const towerRushCapabilitiesProvider: TowerRushCapabilities = {
    actorControl,
    orders,
    probes,
    recorder,
    random,
  };
  const operateTowersCapabilitiesProvider: OperateTowersCapabilities = {
    actorControl,
    probes,
    recorder,
  };
  let adaptStrategy: AssembledIntention | null = null;
  let towerRush: AssembledWarlordComponent<TowerRushIntention> | null = null;
  let operateTowers: AssembledIntention | null = null;

  return {
    deliberate({ beliefs, desires, intentions }) {
      const commit = <T extends AssembledIntention>({
        intention,
        desireKind,
        adopt,
      }: CommitArgs<T>): T | null => {
        const desire =
          desires.find((candidate) => candidate.outcome.kind === desireKind) ??
          null;

        if (intention !== null && intentions.includes(intention)) {
          return intention.component.assessCommitment({
            commonBeliefs: beliefs,
            desire,
          })
            ? intention
            : null;
        }

        return desire !== null ? adopt() : null;
      };
      const active: AssembledIntention[] = [];

      adaptStrategy = commit({
        intention: adaptStrategy,
        desireKind: 'MaintainEffectiveStrategy',
        adopt: () =>
          assembleAdaptStrategyIntention({
            capabilities: adaptStrategyCapabilitiesProvider,
          }),
      });
      towerRush = commit({
        intention: towerRush,
        desireKind: 'ExecuteTowerRushStrategy',
        adopt: () =>
          assembleTowerRushIntention({
            capabilities: towerRushCapabilitiesProvider,
          }),
      });
      operateTowers = commit({
        intention: operateTowers,
        desireKind: 'UseMilitaryAssetsEffectively',
        adopt: () =>
          towerRush?.component.positionEstablished
            ? assembleOperateTowersIntention({
                capabilities: operateTowersCapabilitiesProvider,
              })
            : null,
      });

      // Pushed one by one: in Lua, null elements of an array literal leave
      // holes that end iteration early.
      if (adaptStrategy) {
        active.push(adaptStrategy);
      }

      if (towerRush) {
        active.push(towerRush);
      }

      if (operateTowers) {
        active.push(operateTowers);
      }

      return { intentions: active };
    },
  };
}

interface CommitArgs<T extends AssembledIntention> {
  intention: T | null;
  desireKind: WarlordDesireOutcome['kind'];
  adopt: () => T | null;
}
