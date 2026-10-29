import type { UnitId } from '../../../contracts/ids';
import type { ObservedAttack, VisibleEnemy } from '../../../contracts/world';

export { type OperateTowersCommonBeliefs };

/** What operating the towers needs to know from the Common Beliefs. */
interface OperateTowersCommonBeliefs {
  readonly time: number;
  readonly guardTowers: readonly UnitId[];
  readonly idleUnits: readonly UnitId[];
  readonly peasants: readonly UnitId[];
  readonly visibleEnemies: readonly VisibleEnemy[];
  readonly recentAttacks: readonly ObservedAttack[];
}
