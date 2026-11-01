import type { Random } from '@lib/math';
import type { EstablishTowerPosition } from '../../contracts/desires';
import type { WarlordIntentionKind } from '../../contracts/intentions';
import type { WarcraftProbes } from '../../contracts/probes';
import type { DecisionRecorder } from '../../contracts/record';
import { TowerRushRun } from './tower-rush.run';

export {
  createEstablishTowerPositionKind,
  type EstablishTowerPositionCapabilities,
};

interface EstablishTowerPositionCapabilities {
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
  readonly random: Random;
}

interface CreateEstablishTowerPositionKindArgs {
  capabilities: EstablishTowerPositionCapabilities;
}

/**
 * Guard Towers established next to the enemy main and kept repaired, for as
 * long as the strategy wants them.
 */
function createEstablishTowerPositionKind({
  capabilities,
}: CreateEstablishTowerPositionKindArgs): WarlordIntentionKind<EstablishTowerPosition> {
  return {
    paceSeconds: 1,
    // The rush spends the starting Peasants, so it is not tried again.
    failure: { excludeSeconds: 0, attempts: 1, whenExhausted: 'fail' },
    plans: [
      {
        name: 'tower rush with the starting Peasants',
        preference: 0,

        applicable() {
          return true;
        },

        start() {
          return new TowerRushRun({ capabilities });
        },
      },
    ],
  };
}
