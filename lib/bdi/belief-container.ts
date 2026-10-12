import type { BeliefsModel, CommonBeliefsModel } from './beliefs-model';

export { type BeliefContainer, createBeliefContainer };

/**
 * Beliefs and the model that revises them. An instance is created with its
 * first revision, so its Beliefs are never null.
 */
interface BeliefsInstance<TBeliefs, TModel> {
  beliefs: TBeliefs;
  readonly model: TModel;
}

interface BeliefContainerRegisterScopedBeliefsArgs<TCommonBeliefs> {
  component: object;
  beliefsModel: BeliefsModel<unknown, TCommonBeliefs>;
}

/**
 * The agent's belief state: the Common Beliefs, and the Scoped Beliefs of
 * every component that has them, indexed by the component instance. Both are
 * revised by their models, which never leave the container.
 *
 * The beliefs runtime decides when Beliefs are revised, registered, and
 * removed.
 */
interface BeliefContainer<TCommonBeliefs> {
  getCommonBeliefs(): Readonly<TCommonBeliefs>;

  reviseCommonBeliefs(): { beliefs: Readonly<TCommonBeliefs> };

  /** Null beliefs for a component without registered Scoped Beliefs. */
  getScopedBeliefs({ component }: { component: object }): { beliefs: unknown };

  /** Registers the component with the first revision of its Scoped Beliefs. */
  registerScopedBeliefs({
    component,
    beliefsModel,
  }: BeliefContainerRegisterScopedBeliefsArgs<TCommonBeliefs>): void;

  /** Throws for a component without registered Scoped Beliefs. */
  reviseScopedBeliefs({ component }: { component: object }): {
    beliefs: unknown;
  };

  removeScopedBeliefs({ component }: { component: object }): void;

  /** The components with registered Scoped Beliefs, as a new list. */
  scopedComponents(): object[];
}

interface CreateBeliefContainerArgs<TCommonBeliefs, TCommonObservation> {
  commonModel: CommonBeliefsModel<TCommonBeliefs, TCommonObservation>;
}

function createBeliefContainer<TCommonBeliefs, TCommonObservation>({
  commonModel,
}: CreateBeliefContainerArgs<
  TCommonBeliefs,
  TCommonObservation
>): BeliefContainer<TCommonBeliefs> {
  const commonBeliefs: BeliefsInstance<
    TCommonBeliefs,
    CommonBeliefsModel<TCommonBeliefs, TCommonObservation>
  > = {
    beliefs: reviseCommon({ model: commonModel, previous: null }),
    model: commonModel,
  };
  const scopedBeliefs = new Map<
    object,
    BeliefsInstance<unknown, BeliefsModel<unknown, TCommonBeliefs>>
  >();

  return {
    getCommonBeliefs: () => commonBeliefs.beliefs,

    reviseCommonBeliefs() {
      commonBeliefs.beliefs = reviseCommon({
        model: commonBeliefs.model,
        previous: commonBeliefs.beliefs,
      });

      return { beliefs: commonBeliefs.beliefs };
    },

    getScopedBeliefs: ({ component }) => ({
      beliefs: scopedBeliefs.get(component)?.beliefs ?? null,
    }),

    registerScopedBeliefs({ component, beliefsModel }) {
      if (scopedBeliefs.has(component)) {
        throw new Error('Beliefs: component already registered.');
      }

      scopedBeliefs.set(component, {
        beliefs: reviseScoped({
          model: beliefsModel,
          previous: null,
          commonBeliefs: commonBeliefs.beliefs,
        }),
        model: beliefsModel,
      });
    },

    reviseScopedBeliefs({ component }) {
      const scopedBeliefsInstance = scopedBeliefs.get(component);

      if (!scopedBeliefsInstance) {
        throw new Error('Beliefs: component has no Scoped Beliefs.');
      }

      scopedBeliefsInstance.beliefs = reviseScoped({
        model: scopedBeliefsInstance.model,
        previous: scopedBeliefsInstance.beliefs,
        commonBeliefs: commonBeliefs.beliefs,
      });

      return { beliefs: scopedBeliefsInstance.beliefs };
    },

    removeScopedBeliefs({ component }) {
      scopedBeliefs.delete(component);
    },

    scopedComponents: () => [...scopedBeliefs.keys()],
  };
}

interface ReviseCommonArgs<TCommonBeliefs, TCommonObservation> {
  model: CommonBeliefsModel<TCommonBeliefs, TCommonObservation>;
  previous: TCommonBeliefs | null;
}

function reviseCommon<TCommonBeliefs, TCommonObservation>({
  model,
  previous,
}: ReviseCommonArgs<TCommonBeliefs, TCommonObservation>) {
  return model.revise({ previous, observation: model.observe() });
}

interface ReviseScopedArgs<TCommonBeliefs> {
  model: BeliefsModel<unknown, TCommonBeliefs>;
  previous: unknown;
  commonBeliefs: Readonly<TCommonBeliefs>;
}

function reviseScoped<TCommonBeliefs>({
  model,
  previous,
  commonBeliefs,
}: ReviseScopedArgs<TCommonBeliefs>) {
  return model.revise({
    previous,
    observation: model.observe(),
    commonBeliefs,
  });
}
