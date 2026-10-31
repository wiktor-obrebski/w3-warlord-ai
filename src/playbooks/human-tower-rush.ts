import { RANK } from '@lib/chain-of-command';
import type { Beliefs } from '../contracts/beliefs';
import type { WarlordProposal } from '../contracts/desires';
import type { Playbook } from '../contracts/playbook';

export { HUMAN_TOWER_RUSH };

/**
 * Guard Towers next to the enemy main, built by the starting Peasants and
 * funded by a home economy. Once the towers stand, their fire is directed
 * too.
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
    {
      name: 'Hold',

      begins({ beliefs }) {
        return rushTowersStand({ beliefs })
          ? 'the rush towers stand as Guard Towers'
          : null;
      },

      propose() {
        return [establishTowerPosition(), operateTowers()];
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

function operateTowers(): WarlordProposal {
  return {
    outcome: { kind: 'OperateTowers' },
    rank: RANK.GAME_PLAN,
    weight: PlaybookWeight,
    reason: 'the Guard Towers stand',
  };
}

// The rush builds all its Scout Towers before it upgrades any, so they stand
// once none is left to upgrade and no upgrade is under way.
function rushTowersStand({ beliefs }: { beliefs: Beliefs }): boolean {
  const { scoutTowers, guardTowers, buildingsUpgrading } = beliefs.self;

  return (
    scoutTowers.length === 0 &&
    guardTowers.length > 0 &&
    guardTowers.every((tower) => !buildingsUpgrading.includes(tower))
  );
}
