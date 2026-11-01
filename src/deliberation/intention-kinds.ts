import type { Random } from '@lib/math';
import type { PlaybookName, WarlordOutcome } from '../contracts/desires';
import type { WarlordIntentionKind } from '../contracts/intentions';
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
  createRunEconomyKind,
  RunEconomyCapabilities,
} from '../intentions/run-economy/run-economy.api';
import { HUMAN_TOWER_RUSH } from '../playbooks/human-tower-rush';

export { createIntentionKinds };

interface CreateIntentionKindsArgs {
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
  random: Random;
}

/**
 * The adoption registry: the kind of Intention that pursues each kind of
 * outcome, created with the capabilities it needs.
 */
function createIntentionKinds({
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
    { probes, recorder, random };
  const runEconomyCapabilitiesProvider: RunEconomyCapabilities = {
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
    RunEconomy: createRunEconomyKind({
      capabilities: runEconomyCapabilitiesProvider,
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
