import type { Random } from '@lib/math';
import type { ActorControl } from '../contracts/actor-control';
import type { PlaybookName, WarlordOutcome } from '../contracts/desires';
import type { WarlordIntentionKind } from '../contracts/intentions';
import type { Directives } from '../contracts/directives';
import type { Playbook } from '../contracts/playbook';
import type { WarcraftProbes } from '../contracts/probes';
import type { DecisionRecorder } from '../contracts/record';
import {
  createEstablishTowerPositionKind,
  EstablishTowerPositionCapabilities,
} from '../intentions/establish-tower-position/establish-tower-position.api';
import {
  createExecuteStrategyKind,
  ExecuteStrategyCapabilities,
} from '../intentions/execute-strategy/execute-strategy.api';
import {
  createOperateTowersKind,
  OperateTowersCapabilities,
} from '../intentions/operate-towers/operate-towers.api';
import { HUMAN_TOWER_RUSH } from '../playbooks/human-tower-rush';

export { createIntentionKinds };

interface CreateIntentionKindsArgs {
  actorControl: ActorControl;
  directives: Directives;
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
  random: Random;
}

/**
 * The adoption registry: the kind of Intention that pursues each kind of
 * outcome, created with the capabilities it needs.
 */
function createIntentionKinds({
  actorControl,
  directives,
  probes,
  recorder,
  random,
}: CreateIntentionKindsArgs): ({
  outcome,
}: {
  outcome: WarlordOutcome;
}) => WarlordIntentionKind<WarlordOutcome> {
  const executeStrategyCapabilitiesProvider: ExecuteStrategyCapabilities = {
    playbooks: Playbooks,
    recorder,
  };
  const establishTowerPositionCapabilitiesProvider: EstablishTowerPositionCapabilities =
    { actorControl, directives, probes, recorder, random };
  const operateTowersCapabilitiesProvider: OperateTowersCapabilities = {
    actorControl,
    probes,
    recorder,
  };
  const kinds: IntentionKinds = {
    ExecuteStrategy: createExecuteStrategyKind({
      capabilities: executeStrategyCapabilitiesProvider,
    }),
    EstablishTowerPosition: createEstablishTowerPositionKind({
      capabilities: establishTowerPositionCapabilitiesProvider,
    }),
    OperateTowers: createOperateTowersKind({
      capabilities: operateTowersCapabilitiesProvider,
    }),
  };

  return ({ outcome }) => kinds[outcome.kind];
}

type IntentionKinds = {
  readonly [TKind in WarlordOutcome['kind']]: WarlordIntentionKind<
    Extract<WarlordOutcome, { kind: TKind }>
  >;
};

const Playbooks: Readonly<Record<PlaybookName, Playbook>> = {
  HumanTowerRush: HUMAN_TOWER_RUSH,
};
