import { Deliberation } from '@lib/bdi';
import { CommonBeliefs } from '../beliefs/common.beliefs';
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
import type { Strategy } from '../contracts/strategy';
import {
  assembleAdaptStrategyIntention,
  AdaptStrategyCapabilities,
} from '../components/intentions/adapt-strategy/adapt-strategy.api';
import {
  assembleMaintainWorkerSafetyIntention,
  MaintainWorkerSafetyCapabilities,
} from '../components/intentions/maintain-worker-safety/maintain-worker-safety.api';
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
type AssembledIntention = AssembledWarlordComponent<
  WarlordIntention<CommonBeliefs, unknown>,
  CommonBeliefs
>;

interface WarlordDeliberation extends Deliberation<
  CommonBeliefs,
  WarlordDesire,
  AssembledIntention
> {
  /** The strategy the latest deliberation committed to, if any. */
  currentStrategy(): Strategy | null;
}

interface CreateDeliberationArgs {
  actorControl: ActorControl;
  desireExpression: WarlordDesireExpression;
}

/**
 * A fixed policy for now, adopting one Intention for each Desire:
 *
 * - ProtectEconomicAssets → MaintainWorkerSafety
 * - MaintainEffectiveStrategy → AdaptStrategy
 * - ExecuteTowerRushStrategy → TowerRush, the bot's strategy commitment
 * - UseMilitaryAssetsEffectively → OperateTowers, once the tower rush has
 *   established its Guard Tower position
 *
 * A retained Intention is kept for as long as it assesses its commitment as
 * still worthwhile, even if its Desire is gone, and dropped otherwise.
 *
 * Intentions are returned in update order. Worker safety comes first so it
 * takes attacked workers over before the others order them on the same tick.
 *
 * Deliberation remembers the Intentions it assembled, so it can tell them
 * apart and read their state.
 */
function createDeliberation({
  actorControl,
  desireExpression,
}: CreateDeliberationArgs): WarlordDeliberation {
  const workerSafetyCapabilitiesProvider: MaintainWorkerSafetyCapabilities = {
    actorControl,
  };
  const adaptStrategyCapabilitiesProvider: AdaptStrategyCapabilities = {
    desireExpression,
  };
  const towerRushCapabilitiesProvider: TowerRushCapabilities = {
    actorControl,
  };
  const operateTowersCapabilitiesProvider: OperateTowersCapabilities = {
    actorControl,
  };
  let workerSafety: AssembledIntention | null = null;
  let adaptStrategy: AssembledIntention | null = null;
  let towerRush: AssembledWarlordComponent<
    TowerRushIntention<CommonBeliefs>,
    CommonBeliefs
  > | null = null;
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

      workerSafety = commit({
        intention: workerSafety,
        desireKind: 'ProtectEconomicAssets',
        adopt: () =>
          assembleMaintainWorkerSafetyIntention<CommonBeliefs>({
            capabilities: workerSafetyCapabilitiesProvider,
          }),
      });
      adaptStrategy = commit({
        intention: adaptStrategy,
        desireKind: 'MaintainEffectiveStrategy',
        adopt: () =>
          assembleAdaptStrategyIntention<CommonBeliefs>({
            capabilities: adaptStrategyCapabilitiesProvider,
          }),
      });
      towerRush = commit({
        intention: towerRush,
        desireKind: 'ExecuteTowerRushStrategy',
        adopt: () =>
          assembleTowerRushIntention<CommonBeliefs>({
            capabilities: towerRushCapabilitiesProvider,
          }),
      });
      operateTowers = commit({
        intention: operateTowers,
        desireKind: 'UseMilitaryAssetsEffectively',
        adopt: () =>
          towerRush?.component.positionEstablished
            ? assembleOperateTowersIntention<CommonBeliefs>({
                capabilities: operateTowersCapabilitiesProvider,
              })
            : null,
      });

      // Pushed one by one: in Lua, null elements of an array literal leave
      // holes that end iteration early.
      if (workerSafety) {
        active.push(workerSafety);
      }

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

    currentStrategy() {
      return towerRush !== null ? 'TowerRush' : null;
    },
  };
}

interface CommitArgs<T extends AssembledIntention> {
  intention: T | null;
  desireKind: WarlordDesireOutcome['kind'];
  adopt: () => T | null;
}
