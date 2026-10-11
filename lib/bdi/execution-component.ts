import type { AnyBeliefModel } from "./belief-model";

/**
 * Common shape of Intentions, Plans, and Controllers, through which the
 * runtime finds the active execution graph: which belief models it needs and
 * which sources may hold actor control.
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

/**
 * The components and all their active descendants, parents first.
 */
export function activeComponents(
  components: readonly ExecutionComponent[],
): ExecutionComponent[] {
  const active: ExecutionComponent[] = [];

  const visit = (component: ExecutionComponent) => {
    active.push(component);

    for (const child of component.activeChildren?.() ?? []) {
      visit(child);
    }
  };

  for (const component of components) {
    visit(component);
  }

  return active;
}
