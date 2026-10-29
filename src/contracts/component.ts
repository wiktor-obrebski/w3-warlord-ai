import type {
  AssembledComponent,
  Controller,
  Intention,
  Plan,
  UpdateChild,
} from '@lib/bdi';
import type { Beliefs } from './beliefs';
import type { WarlordDesire } from './desires';

export {
  type WarlordPlan,
  type WarlordController,
  type WarlordIntention,
  type WarlordUpdateChild,
  type AssembledWarlordComponent,
  type AssembledChildren,
};

type WarlordPlan = Plan<Beliefs>;

type WarlordController = Controller<Beliefs>;

type WarlordIntention = Intention<Beliefs, Beliefs, Beliefs, WarlordDesire>;

type WarlordUpdateChild = UpdateChild<Beliefs>;

/** A component as its `assemble...` function returns it. */
type AssembledWarlordComponent<TComponent extends object> = AssembledComponent<
  TComponent,
  Beliefs
>;

/** The children list an assemble function keeps for its component. */
type AssembledChildren = AssembledWarlordComponent<object>[];
