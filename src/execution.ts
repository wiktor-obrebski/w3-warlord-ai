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

/**
 * The Beliefs a Warlord component reads: the Common Beliefs and its own
 * Scoped Beliefs, null for components without them.
 */
export type WarlordBeliefs<TScopedBeliefs = null> = ComponentBeliefs<
  CommonBeliefs,
  TScopedBeliefs
>;

export type WarlordPlan<TScopedBeliefs = null> = Plan<
  WarlordBeliefs<TScopedBeliefs>,
  ActorControl
>;

export type WarlordController<TScopedBeliefs = null> = Controller<
  WarlordBeliefs<TScopedBeliefs>,
  ActorControl
>;

export type WarlordIntention<TScopedBeliefs = null> = Intention<
  WarlordBeliefs<TScopedBeliefs>,
  ActorControl,
  WarlordBeliefs<unknown>
>;

export type WarlordUpdateChild = UpdateChild<
  WarlordBeliefs<unknown>,
  ActorControl
>;

/** A component as its `provide...` function returns it. */
export type ProvidedComponent<TValue extends object> = Provided<
  TValue,
  CommonBeliefs
>;

/** The children list a provider keeps for its component. */
export type ProvidedChildren = Provided<object, CommonBeliefs>[];
