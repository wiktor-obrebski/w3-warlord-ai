import { RANK } from '@lib/chain-of-command';
import type { WarlordProposal } from '../contracts/desires';
import type { Playbook } from '../contracts/playbook';

export { HUMAN_TOWER_RUSH };

/**
 * Guard Towers next to the enemy main, built by the starting Peasants and
 * funded by a home economy.
 */
const HUMAN_TOWER_RUSH: Playbook = {
  phases: [
    {
      name: 'Rush',

      begins() {
        return 'the strategy starts';
      },

      propose() {
        return [establishTowerPosition()];
      },
    },
  ],
};

// Nothing competes with these Desires yet, so their weights only have to be
// above 0.
const PlaybookWeight = 1;

function establishTowerPosition(): WarlordProposal {
  return {
    outcome: { kind: 'EstablishTowerPosition' },
    rank: RANK.GAME_PLAN,
    weight: PlaybookWeight,
    reason: 'the rush needs Guard Towers next to the enemy main',
  };
}
