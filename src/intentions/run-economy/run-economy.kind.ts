import type { RunEconomy } from '../../contracts/desires';
import type { WarlordIntentionKind } from '../../contracts/intentions';
import type { WarcraftProbes } from '../../contracts/probes';
import type { DecisionRecorder } from '../../contracts/record';
import { HumanEconomyRun } from './human-economy.run';

export { createRunEconomyKind, type RunEconomyCapabilities };

interface RunEconomyCapabilities {
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
}

interface CreateRunEconomyKindArgs {
  capabilities: RunEconomyCapabilities;
}

/**
 * A home economy, built up as the build order in its goal says. Each plan
 * runs the economy of one race; only the Human one exists so far.
 */
function createRunEconomyKind({
  capabilities,
}: CreateRunEconomyKindArgs): WarlordIntentionKind<RunEconomy> {
  return {
    paceSeconds: 1,
    failure: { excludeSeconds: 10, attempts: 1, whenExhausted: 'recur' },
    plans: [
      {
        name: 'Human economy',
        preference: 0,

        applicable({ beliefs }) {
          return beliefs.self.race === 'Human';
        },

        start({ goal }) {
          return new HumanEconomyRun({
            buildOrder: goal.buildOrder,
            capabilities,
          });
        },
      },
    ],
  };
}
