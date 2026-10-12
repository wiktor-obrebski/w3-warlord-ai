import {
  ComponentBeliefs,
  Controller,
  Intention,
  Plan,
  Provided,
  UpdateChild,
} from '@lib/bdi';
import { ActorControl } from './actor';
import { CommonBeliefs } from './beliefs/common.beliefs';

export {
  type WarlordBeliefs,
  type WarlordPlan,
  type WarlordController,
  type WarlordIntention,
  type WarlordUpdateChild,
  type ProvidedComponent,
  type ProvidedChildren,
};

/**
 * The Beliefs a Warlord component reads: the Common Beliefs and its own
 * Scoped Beliefs, null for components without them.
 */
type WarlordBeliefs<TScopedBeliefs = null> = ComponentBeliefs<
  CommonBeliefs,
  TScopedBeliefs
>;

type WarlordPlan<TScopedBeliefs = null> = Plan<
  WarlordBeliefs<TScopedBeliefs>,
  ActorControl
>;

type WarlordController<TScopedBeliefs = null> = Controller<
  WarlordBeliefs<TScopedBeliefs>,
  ActorControl
>;

type WarlordIntention<TScopedBeliefs = null> = Intention<
  WarlordBeliefs<TScopedBeliefs>,
  ActorControl,
  WarlordBeliefs<unknown>
>;

type WarlordUpdateChild = UpdateChild<WarlordBeliefs<unknown>, ActorControl>;

/**
 * The Scoped Beliefs type a component's `update` reads, so its provider can
 * only attach a model producing exactly that.
 */
type ScopedBeliefsOf<TComponent> = TComponent extends {
  update(args: {
    beliefs: { readonly scopedBeliefs: infer TScopedBeliefs };
  }): void;
}
  ? TScopedBeliefs
  : never;

/** A component as its `provide...` function returns it. */
type ProvidedComponent<TComponent extends object> = Provided<
  TComponent,
  CommonBeliefs,
  ScopedBeliefsOf<TComponent>
>;

/** The children list a provider keeps for its component. */
type ProvidedChildren = Provided<object, CommonBeliefs>[];
