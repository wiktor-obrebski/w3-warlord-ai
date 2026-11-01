import type { Point } from '@lib/math';
import type { UnitId } from './ids';
import type { ObservedEnemy, ObservedSelf } from './observations';
import type { GoldMine, ObservedAttack } from './world';

export { type Beliefs, type SelfBeliefs, type EnemyBeliefs };

/**
 * The bot's one world model: what it believes is, or probably is, true of
 * the game. Belief models revise each section from the observations at the
 * start of every step; to everything else, the Beliefs are read-only.
 */
interface Beliefs {
  // Game seconds since the bot started playing.
  readonly time: number;
  readonly self: SelfBeliefs;
  readonly enemy: EnemyBeliefs;
}

interface SelfBeliefs extends ObservedSelf {
  readonly finishedLumberMills: readonly UnitId[];
  // The latest attack of each visible attacker, and every attack by an
  // unseen one, while still recent; oldest first.
  readonly recentAttacks: readonly ObservedAttack[];
}

interface EnemyBeliefs extends ObservedEnemy {
  // Known only when the map has a single start location besides the bot's
  // own: then the enemy can only have started there.
  readonly startPosition?: Point;
  readonly mainGoldMine?: GoldMine;
}
