import { RANK, type ProposalSource } from '@lib/chain-of-command';
import type { Beliefs } from '../contracts/beliefs';
import type { WarlordOutcome, WarlordProposal } from '../contracts/desires';

export { proposeConcerns };

interface ProposeConcernsArgs {
  beliefs: Beliefs;
}

/** What each of the bot's concerns proposes in a deliberation cycle. */
function proposeConcerns({
  beliefs,
}: ProposeConcernsArgs): ProposalSource<WarlordOutcome>[] {
  return Concerns.map((concern) => ({
    name: concern.name,
    proposals: concern.propose({ beliefs }),
  }));
}

/** Something the bot cares about all game, proposing Desires for it. */
interface Concern {
  readonly name: string;
  propose({ beliefs }: { beliefs: Beliefs }): readonly WarlordProposal[];
}

// Nothing competes with the strategy yet, so its weight only has to be above
// 0.
const StrategyWeight = 1;

/**
 * Proposes the strategy the bot prefers: the Human tower rush, the only
 * playbook so far, which needs to know where the enemy started. Vetoed while
 * the enemy start is unknown, so the record says why the bot does not rush.
 */
const strategyConcern: Concern = {
  name: 'strategy concern',

  propose({ beliefs }) {
    if (beliefs.self.race !== 'Human') {
      return [];
    }

    const outcome: WarlordOutcome = {
      kind: 'ExecuteStrategy',
      playbook: 'HumanTowerRush',
    };

    return [
      beliefs.enemy.startPosition
        ? {
            outcome,
            rank: RANK.GAME_PLAN,
            weight: StrategyWeight,
            reason: 'a Human knowing the enemy start',
          }
        : {
            outcome,
            rank: RANK.GAME_PLAN,
            weight: 0,
            reason: 'the enemy start is unknown',
          },
    ];
  },
};

const Concerns: readonly Concern[] = [strategyConcern];
