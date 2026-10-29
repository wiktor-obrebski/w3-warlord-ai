import type { Beliefs } from '../../../contracts/beliefs';
import type { Strategy } from '../../../contracts/strategy';

export { type StrategyPreference, preferredStrategy };

interface StrategyPreference {
  // Null when the bot has no strategy for the situation.
  readonly strategy: Strategy | null;
  readonly reason: string;
}

interface PreferredStrategyArgs {
  beliefs: Beliefs;
}

/**
 * The strategy currently worth executing, and why. The tower rush is the only
 * strategy so far: only Humans can play it, and it needs to know where the
 * enemy started.
 */
function preferredStrategy({
  beliefs,
}: PreferredStrategyArgs): StrategyPreference {
  if (beliefs.self.race !== 'Human') {
    return { strategy: null, reason: 'no strategy for this race' };
  }

  if (!beliefs.enemy.startPosition) {
    return { strategy: null, reason: 'the enemy start is unknown' };
  }

  return { strategy: 'TowerRush', reason: 'a Human knowing the enemy start' };
}
