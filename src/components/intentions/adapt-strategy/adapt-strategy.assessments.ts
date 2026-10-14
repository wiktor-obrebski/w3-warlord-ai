import type { Strategy } from '../../../contracts/strategy';
import type { AdaptStrategyCommonBeliefs } from './adapt-strategy.common-beliefs';

export { preferredStrategy };

interface PreferredStrategyArgs {
  beliefs: AdaptStrategyCommonBeliefs;
}

/**
 * The strategy currently worth executing, or null when the bot has none for
 * the situation. The tower rush is the only strategy so far, and only
 * Humans can play it.
 */
function preferredStrategy({
  beliefs,
}: PreferredStrategyArgs): Strategy | null {
  return beliefs.ownRace === 'Human' ? 'TowerRush' : null;
}
