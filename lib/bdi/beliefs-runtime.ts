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
  readonly common: Readonly<TCommonBeliefs>;
  readonly scoped: TScopedBeliefs;
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
  const container = createBeliefContainer<TCommonBeliefs>();
  let roots: readonly Provided<object, TCommonBeliefs>[] = [];
  let managed = new Set<object>();

  const reviseScoped = ({ component }: { component: object }) => {
    const { beliefs: previous, beliefsModel } = container.getScopedBeliefs({
      component,
    });
    const observation = beliefsModel.observe();

    container.setScopedBeliefs({
      component,
      beliefs: beliefsModel.revise({
        previous,
        observation,
        common: container.getCommonBeliefs(),
      }),
    });
  };

  // Matches the managed components to the current tree, registering new
  // components without revising them. Returns the newly registered ones that
  // have Scoped Beliefs.
  const refresh = (): object[] => {
    const current = new Set<object>();
    const registered: object[] = [];

    const visit = ({ provided }: VisitArgs<TCommonBeliefs>) => {
      current.add(provided.value);

      if (
        provided.beliefsModel &&
        !container.hasScopedBeliefs({ component: provided.value })
      ) {
        container.registerScopedBeliefs({
          component: provided.value,
          beliefsModel: provided.beliefsModel,
        });
        registered.push(provided.value);
      }

      for (const child of provided.children) {
        visit({ provided: child });
      }
    };

    for (const root of roots) {
      visit({ provided: root });
    }

    for (const component of container.scopedComponents()) {
      if (!current.has(component)) {
        container.removeScopedBeliefs({ component });
      }
    }

    managed = current;

    return registered;
  };

  return {
    reviseCommon() {
      const previous = container.hasCommonBeliefs()
        ? container.getCommonBeliefs()
        : null;
      const next = commonModel.revise({
        previous,
        observation: commonModel.observe(),
      });

      container.setCommonBeliefs({ beliefs: next });

      return next;
    },

    sync({ roots: newRoots }) {
      roots = newRoots;
      refresh();

      for (const component of container.scopedComponents()) {
        reviseScoped({ component });
      }
    },

    beliefsOf({ component }) {
      if (!managed.has(component)) {
        for (const registered of refresh()) {
          reviseScoped({ component: registered });
        }

        if (!managed.has(component)) {
          throw new Error('Beliefs: component is not in the managed tree.');
        }
      }

      return {
        common: container.getCommonBeliefs(),
        scoped: container.hasScopedBeliefs({ component })
          ? container.getScopedBeliefs({ component }).beliefs
          : null,
      };
    },

    prune() {
      refresh();

      return managed;
    },
  };
}
