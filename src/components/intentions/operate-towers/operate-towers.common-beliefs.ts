import type * as W3UnitApi from '@lib/warcraft3-api/unit';
import type { ObservedAttack, VisibleEnemy } from '../../../contracts/world';

export { type OperateTowersCommonBeliefs };

/** What operating the towers needs to know from the Common Beliefs. */
interface OperateTowersCommonBeliefs {
  readonly time: number;
  readonly guardTowers: readonly W3UnitApi.unit[];
  readonly idleUnits: readonly W3UnitApi.unit[];
  readonly peasants: readonly W3UnitApi.unit[];
  readonly visibleEnemies: readonly VisibleEnemy[];
  readonly recentAttacks: readonly ObservedAttack[];
}
