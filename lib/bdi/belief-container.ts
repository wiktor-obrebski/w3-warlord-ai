import type { AnyBeliefsModel } from './beliefs-model';

export { type ScopedBeliefs, type BeliefContainer, createBeliefContainer };

/**
 * A component's Scoped Beliefs and the model that maintains them.
 */
interface ScopedBeliefs<TCommonBeliefs> {
  /** Null until the component's first revision. */
  readonly beliefs: unknown;
  readonly beliefsModel: AnyBeliefsModel<TCommonBeliefs>;
}

interface BeliefContainerGetScopedBeliefsArgs {
  component: object;
}

interface BeliefContainerRegisterScopedBeliefsArgs<TCommonBeliefs> {
  component: object;
  beliefsModel: AnyBeliefsModel<TCommonBeliefs>;
}

interface BeliefContainerSetScopedBeliefsArgs {
  component: object;
  beliefs: unknown;
}

/**
 * The agent's belief state: the Common Beliefs, and the Scoped Beliefs of
 * every component that has them, indexed by the component instance.
 *
 * The container only stores state; the beliefs runtime decides when it is
 * revised, registered, and removed.
 */
interface BeliefContainer<TCommonBeliefs> {
  hasCommonBeliefs(): boolean;

  /** Throws before the Common Beliefs were first revised. */
  getCommonBeliefs(): Readonly<TCommonBeliefs>;

  setCommonBeliefs({ beliefs }: { beliefs: TCommonBeliefs }): void;

  hasScopedBeliefs({ component }: { component: object }): boolean;

  /** Throws for a component without registered Scoped Beliefs. */
  getScopedBeliefs({
    component,
  }: BeliefContainerGetScopedBeliefsArgs): ScopedBeliefs<TCommonBeliefs>;

  /** Registers the component with no Beliefs yet. */
  registerScopedBeliefs({
    component,
    beliefsModel,
  }: BeliefContainerRegisterScopedBeliefsArgs<TCommonBeliefs>): void;

  setScopedBeliefs({
    component,
    beliefs,
  }: BeliefContainerSetScopedBeliefsArgs): void;

  removeScopedBeliefs({ component }: { component: object }): void;

  /** The components with registered Scoped Beliefs, as a new list. */
  scopedComponents(): object[];
}

interface ScopedEntry<TCommonBeliefs> {
  beliefs: unknown;
  readonly beliefsModel: AnyBeliefsModel<TCommonBeliefs>;
}

function createBeliefContainer<
  TCommonBeliefs,
>(): BeliefContainer<TCommonBeliefs> {
  let common: TCommonBeliefs | null = null;
  const scoped = new Map<object, ScopedEntry<TCommonBeliefs>>();

  const scopedEntry = ({ component }: { component: object }) => {
    const entry = scoped.get(component);

    if (!entry) {
      throw new Error('Beliefs: component has no Scoped Beliefs.');
    }

    return entry;
  };

  return {
    hasCommonBeliefs: () => common !== null,

    getCommonBeliefs() {
      if (common === null) {
        throw new Error('Beliefs: Common Beliefs not revised yet.');
      }

      return common;
    },

    setCommonBeliefs({ beliefs }) {
      common = beliefs;
    },

    hasScopedBeliefs: ({ component }) => scoped.has(component),

    getScopedBeliefs: ({ component }) => scopedEntry({ component }),

    registerScopedBeliefs({ component, beliefsModel }) {
      if (scoped.has(component)) {
        throw new Error('Beliefs: component already registered.');
      }

      scoped.set(component, { beliefs: null, beliefsModel });
    },

    setScopedBeliefs({ component, beliefs }) {
      scopedEntry({ component }).beliefs = beliefs;
    },

    removeScopedBeliefs({ component }) {
      scoped.delete(component);
    },

    scopedComponents: () => [...scoped.keys()],
  };
}
