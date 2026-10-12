import { createBeliefContainer } from './belief-container';
import type { CommonBeliefsModel } from './beliefs-model';
import type { Provided } from './provided';

export { type ComponentBeliefs, type BeliefsRuntime, createBeliefsRuntime };

/**
 * The Beliefs one component reads during its update: the Common Beliefs and
 * its own Scoped Beliefs, which are null for a component without a
 * BeliefsModel. Scoped Beliefs types should have read-only properties.
 */
interface ComponentBeliefs<TCommonBeliefs, TScopedBeliefs> {
  readonly commonBeliefs: Readonly<TCommonBeliefs>;
  readonly scopedBeliefs: TScopedBeliefs;
}

interface BeliefsRuntimeBeliefsOfArgs {
  component: object;
}

/**
 * Owns the agent's belief state and its lifecycle. It manages the component
 * tree formed by the provided Intentions and their children: every component
 * with a BeliefsModel gets Scoped Beliefs, revised each cycle, and loses them
 * when it leaves the tree.
 */
interface BeliefsRuntime<TCommonBeliefs> {
  /**
   * Revises the Common Beliefs; the first step of every cycle.
   */
  reviseCommon(): Readonly<TCommonBeliefs>;

  /**
   * Makes the tree under `roots` the managed component tree: registers
   * components new to it, removes the Scoped Beliefs of components gone from
   * it, and revises the Scoped Beliefs of every registered component.
   */
  sync({ roots }: { roots: readonly Provided<object, TCommonBeliefs>[] }): void;

  /**
   * The Beliefs of a managed component for this cycle. A component created
   * since the last sync is registered and first revised here, so its Scoped
   * Beliefs exist before its first update.
   */
  beliefsOf({
    component,
  }: BeliefsRuntimeBeliefsOfArgs): ComponentBeliefs<TCommonBeliefs, unknown>;

  /**
   * Removes components gone from the tree since the last sync, such as
   * discarded children, and returns the managed components.
   */
  prune(): ReadonlySet<object>;
}

interface CreateBeliefsRuntimeArgs<TCommonObservation, TCommonBeliefs> {
  commonModel: CommonBeliefsModel<TCommonObservation, TCommonBeliefs>;
}

interface VisitArgs<TCommonBeliefs> {
  provided: Provided<object, TCommonBeliefs>;
}

function createBeliefsRuntime<TCommonObservation, TCommonBeliefs>({
  commonModel,
}: CreateBeliefsRuntimeArgs<
  TCommonObservation,
  TCommonBeliefs
>): BeliefsRuntime<TCommonBeliefs> {
  const beliefsContainer = createBeliefContainer({ commonModel });
  let roots: readonly Provided<object, TCommonBeliefs>[] = [];
  let managedComponents = new Set<object>();

  // Matches the managed components to the current tree. Returns the newly
  // registered components with Scoped Beliefs, which registration has
  // already revised once.
  const refresh = (): object[] => {
    const currentComponents = new Set<object>();
    const registeredComponents: object[] = [];

    const visit = ({ provided }: VisitArgs<TCommonBeliefs>) => {
      const { component } = provided;
      currentComponents.add(component);

      if (
        provided.beliefsModel &&
        beliefsContainer.getScopedBeliefs({ component }) === null
      ) {
        beliefsContainer.registerScopedBeliefs({
          component,
          beliefsModel: provided.beliefsModel,
        });
        registeredComponents.push(component);
      }

      for (const child of provided.children) {
        visit({ provided: child });
      }
    };

    for (const root of roots) {
      visit({ provided: root });
    }

    for (const component of beliefsContainer.scopedComponents()) {
      if (!currentComponents.has(component)) {
        beliefsContainer.removeScopedBeliefs({ component });
      }
    }

    managedComponents = currentComponents;

    return registeredComponents;
  };

  return {
    reviseCommon: () => beliefsContainer.reviseCommonBeliefs(),

    sync({ roots: newRoots }) {
      roots = newRoots;
      const registeredComponents = new Set(refresh());

      for (const component of beliefsContainer.scopedComponents()) {
        if (!registeredComponents.has(component)) {
          beliefsContainer.reviseScopedBeliefs({ component });
        }
      }
    },

    beliefsOf({ component }) {
      if (!managedComponents.has(component)) {
        refresh();

        if (!managedComponents.has(component)) {
          throw new Error('Beliefs: component is not in the managed tree.');
        }
      }

      return {
        commonBeliefs: beliefsContainer.getCommonBeliefs(),
        scopedBeliefs: beliefsContainer.getScopedBeliefs({ component }),
      };
    },

    prune() {
      refresh();

      return managedComponents;
    },
  };
}
