import { RANK } from '@lib/chain-of-command';
import * as W3HumanApi from '@lib/warcraft3-api/human';
import type { BuildOrder } from '../contracts/build-order';
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
        return [establishTowerPosition(), runEconomy()];
      },
    },
  ],
};

// Nothing competes with these Desires yet, so their weights only have to be
// above 0.
const PlaybookWeight = 1;

// The Lumber Mill comes first, as the Guard Tower upgrades require it. Its
// builder harvests lumber once it is done, and counts as a lumber worker from
// the start. Lumber workers come in early so the upgrades are not starved of
// lumber.
const TowerRushBuildOrder: BuildOrder = {
  name: 'TowerRush',
  opening: [W3HumanApi.Building.LUMBER_MILL],
  workerTargets: [
    { gold: 2, lumber: 1 },
    { gold: 2, lumber: 2 },
    { gold: 2, lumber: 3 },
    { gold: 3, lumber: 3 },
    { gold: 3, lumber: 4 },
    { gold: 4, lumber: 4 },
    { gold: 4, lumber: 5 },
  ],
};

function establishTowerPosition(): WarlordProposal {
  return {
    outcome: { kind: 'EstablishTowerPosition' },
    rank: RANK.GAME_PLAN,
    weight: PlaybookWeight,
    reason: 'the rush needs Guard Towers next to the enemy main',
  };
}

// Ranked below the game plan, so the rush is served first and the economy
// takes the workers it leaves.
function runEconomy(): WarlordProposal {
  return {
    outcome: { kind: 'RunEconomy', buildOrder: TowerRushBuildOrder },
    rank: RANK.BACKGROUND,
    weight: PlaybookWeight,
    reason: 'the rush is funded by a home economy',
  };
}
