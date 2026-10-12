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

/** A component as its `provide...` function returns it. */
type ProvidedComponent<TComponent extends object> = Provided<
  TComponent,
  CommonBeliefs
>;

/** The children list a provider keeps for its component. */
type ProvidedChildren = Provided<object, CommonBeliefs>[];
