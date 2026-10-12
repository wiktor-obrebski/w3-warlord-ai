import {
  AssembledComponent,
  ComponentBeliefs,
  Controller,
  Intention,
  Plan,
  UpdateChild,
} from '@lib/bdi';
import { CommonBeliefs } from './beliefs/common.beliefs';

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
 * The Beliefs a Warlord component reads: the Common Beliefs and its own
 * Scoped Beliefs, null for components without them.
 */
type WarlordBeliefs<TScopedBeliefs = null> = ComponentBeliefs<
  CommonBeliefs,
  TScopedBeliefs
>;

type WarlordPlan<TScopedBeliefs = null> = Plan<WarlordBeliefs<TScopedBeliefs>>;

type WarlordController<TScopedBeliefs = null> = Controller<
  WarlordBeliefs<TScopedBeliefs>
>;

type WarlordIntention<TScopedBeliefs = null> = Intention<
  WarlordBeliefs<TScopedBeliefs>,
  WarlordBeliefs<unknown>
>;

type WarlordUpdateChild = UpdateChild<WarlordBeliefs<unknown>>;

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

/** A component as its `assemble...` function returns it. */
type AssembledWarlordComponent<TComponent extends object> = AssembledComponent<
  TComponent,
  CommonBeliefs,
  ScopedBeliefsOf<TComponent>
>;

/** The children list an assemble function keeps for its component. */
type AssembledChildren = AssembledComponent<object, CommonBeliefs>[];
