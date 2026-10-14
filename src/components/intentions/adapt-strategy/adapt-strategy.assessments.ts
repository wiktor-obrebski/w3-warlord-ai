import type { Strategy } from '../../../contracts/strategy';
import type { AdaptStrategyCommonBeliefs } from './adapt-strategy.common-beliefs';

export { preferredStrategy };

/**
 * The strategy currently worth executing, or null when the bot has none for
 * the situation. The tower rush is the only strategy so far, and only
 * Humans can play it.
 */
function preferredStrategy({
  beliefs,
}: {
  beliefs: AdaptStrategyCommonBeliefs;
}): Strategy | null {
  return beliefs.ownRace === 'Human' ? 'TowerRush' : null;
}
