import type {
  AssembledComponent,
  ComponentBeliefs,
  Controller,
  Intention,
  Plan,
  UpdateChild,
} from '@lib/bdi';
import type { WarlordDesire } from './desires';

export {
  type WarlordBeliefs,
  type WarlordPlan,
  type WarlordController,
  type WarlordIntention,
  type WarlordUpdateChild,
  type AssembledWarlordComponent,
  type AssembledChildren,
};

/**
 * The Beliefs a Warlord component reads: the Common Beliefs it declares it
 * needs, and its own Scoped Beliefs, null for components without them.
 *
 * `TCommonBeliefs` is the component's own declaration of what it needs to
 * know, not the bot's whole Common Beliefs; at runtime it receives the whole
 * Common Beliefs, which provide at least that.
 */
type WarlordBeliefs<TCommonBeliefs, TScopedBeliefs = null> = ComponentBeliefs<
  TCommonBeliefs,
  TScopedBeliefs
>;

type WarlordPlan<TCommonBeliefs, TScopedBeliefs = null> = Plan<
  WarlordBeliefs<TCommonBeliefs, TScopedBeliefs>
>;

type WarlordController<TCommonBeliefs, TScopedBeliefs = null> = Controller<
  WarlordBeliefs<TCommonBeliefs, TScopedBeliefs>
>;

type WarlordIntention<TCommonBeliefs, TScopedBeliefs = null> = Intention<
  WarlordBeliefs<TCommonBeliefs, TScopedBeliefs>,
  WarlordBeliefs<TCommonBeliefs, unknown>,
  TCommonBeliefs,
  WarlordDesire
>;

type WarlordUpdateChild<TCommonBeliefs> = UpdateChild<
  WarlordBeliefs<TCommonBeliefs, unknown>
>;

/**
 * A component as its `assemble...` function returns it, for a bot whose
 * Common Beliefs are `TCommonBeliefs`.
 */
type AssembledWarlordComponent<
  TComponent extends object,
  TCommonBeliefs,
> = AssembledComponent<TComponent, TCommonBeliefs, ScopedBeliefsOf<TComponent>>;

/** The children list an assemble function keeps for its component. */
type AssembledChildren<TCommonBeliefs> = AssembledComponent<
  object,
  TCommonBeliefs
>[];

/**
 * The Scoped Beliefs type a component's `update` reads, so its assemble
 * function can only attach a model producing exactly that.
 */
type ScopedBeliefsOf<TComponent> = TComponent extends {
  update(args: {
    beliefs: { readonly scopedBeliefs: infer TScopedBeliefs };
  }): void;
}
  ? TScopedBeliefs
  : never;
