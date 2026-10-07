import type { AnyBeliefModel } from "./belief-model";

/**
 * Common shape of Intentions, Plans, and Controllers, through which the
 * belief runtime finds which belief models are needed.
 *
 * The runtime walks the active Intentions and their active children and keeps
 * every belief model they declare, and those models' dependencies, revised.
 */
export interface ExecutionComponent {
  /**
   * The belief model instances this component reads, other than those the
   * agent always keeps. Belief state belongs to the model instance, so a
   * component that needs Beliefs of its own creates its own instances.
   */
  readonly beliefModels?: readonly AnyBeliefModel[];

  /**
   * The Plans and Controllers currently active under this component, decided
   * from its own execution state and the current Beliefs. A child whose
   * Beliefs would only tell whether it has work should stay active and do
   * nothing instead.
   */
  activeChildren?(): readonly ExecutionComponent[];
}
