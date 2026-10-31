import type { ActorControl } from '../../contracts/actor-control';
import type { OperateTowers } from '../../contracts/desires';
import type { WarlordIntentionKind } from '../../contracts/intentions';
import type { WarcraftProbes } from '../../contracts/probes';
import type { DecisionRecorder } from '../../contracts/record';
import { TowerTargetSelectionController } from './tower-target-selection.ctrl';

export { createOperateTowersKind, type OperateTowersCapabilities };

interface OperateTowersCapabilities {
  readonly actorControl: ActorControl;
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
}

interface CreateOperateTowersKindArgs {
  capabilities: OperateTowersCapabilities;
}

/** Directs the fire of the bot's Guard Towers. */
function createOperateTowersKind({
  capabilities,
}: CreateOperateTowersKindArgs): WarlordIntentionKind<OperateTowers> {
  return {
    paceSeconds: 1,
    failure: { excludeSeconds: 10, attempts: 1, whenExhausted: 'recur' },
    plans: [
      {
        name: 'focus fire by target priority',
        preference: 0,

        applicable() {
          return true;
        },

        start() {
          return new TowerTargetSelectionController({ capabilities });
        },
      },
    ],
  };
}
