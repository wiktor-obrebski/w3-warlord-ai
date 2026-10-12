import type {
  ObservedAttack,
  OwnUnit,
  VisibleEnemy,
} from '../../../contracts/world';

export { type MaintainWorkerSafetyCommonBeliefs };

/** What worker safety needs to know from the Common Beliefs. */
interface MaintainWorkerSafetyCommonBeliefs {
  readonly time: number;
  readonly workers: readonly OwnUnit[];
  readonly visibleEnemies: readonly VisibleEnemy[];
  readonly recentAttacks: readonly ObservedAttack[];
}
