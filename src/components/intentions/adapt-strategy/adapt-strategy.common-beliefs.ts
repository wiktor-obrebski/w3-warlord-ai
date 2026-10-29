import type { Point } from '@lib/math';
import type { Race } from '../../../contracts/world';

export { type AdaptStrategyCommonBeliefs };

/** What adapting the strategy needs to know from the Common Beliefs. */
interface AdaptStrategyCommonBeliefs {
  readonly time: number;
  readonly ownRace: Race;
  readonly enemyStartPosition?: Point;
}
