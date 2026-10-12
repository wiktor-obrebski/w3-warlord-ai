import type { AnyBeliefsModel, CommonBeliefsModel } from './beliefs-model';

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
  getCommonBeliefs(): Readonly<TCommonBeliefs>;

  setCommonBeliefs({ beliefs }: { beliefs: TCommonBeliefs }): void;

  /** Null for a component without registered Scoped Beliefs. */
  getScopedBeliefs({
    component,
  }: BeliefContainerGetScopedBeliefsArgs): ScopedBeliefs<TCommonBeliefs> | null;

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

interface CreateBeliefContainerArgs<TCommonObservation, TCommonBeliefs> {
  commonModel: CommonBeliefsModel<TCommonObservation, TCommonBeliefs>;
}

/**
 * Starts with the Common Beliefs of the first revision, so they are always
 * available.
 */
function createBeliefContainer<TCommonObservation, TCommonBeliefs>({
  commonModel,
}: CreateBeliefContainerArgs<
  TCommonObservation,
  TCommonBeliefs
>): BeliefContainer<TCommonBeliefs> {
  let commonBeliefs = commonModel.revise({
    previous: null,
    observation: commonModel.observe(),
  });
  const scopedBeliefs = new Map<object, ScopedEntry<TCommonBeliefs>>();

  const scopedEntry = ({ component }: { component: object }) => {
    const entry = scopedBeliefs.get(component);

    if (!entry) {
      throw new Error('Beliefs: component has no Scoped Beliefs.');
    }

    return entry;
  };

  return {
    getCommonBeliefs: () => commonBeliefs,

    setCommonBeliefs({ beliefs }) {
      commonBeliefs = beliefs;
    },

    getScopedBeliefs: ({ component }) => scopedBeliefs.get(component) ?? null,

    registerScopedBeliefs({ component, beliefsModel }) {
      if (scopedBeliefs.has(component)) {
        throw new Error('Beliefs: component already registered.');
      }

      scopedBeliefs.set(component, { beliefs: null, beliefsModel });
    },

    setScopedBeliefs({ component, beliefs }) {
      scopedEntry({ component }).beliefs = beliefs;
    },

    removeScopedBeliefs({ component }) {
      scopedBeliefs.delete(component);
    },

    scopedComponents: () => [...scopedBeliefs.keys()],
  };
}
