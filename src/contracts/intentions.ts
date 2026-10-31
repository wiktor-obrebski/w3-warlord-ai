import type {
  Intention,
  IntentionKind,
  Plan,
  PlanRun,
} from '@lib/chain-of-command';
import type { Beliefs } from './beliefs';
import type { WarlordOutcome } from './desires';

export {
  type WarlordIntentionKind,
  type WarlordPlan,
  type WarlordPlanRun,
  type WarlordIntention,
};

/** The kind of the Intentions pursuing outcomes of type `TGoal`. */
type WarlordIntentionKind<TGoal extends WarlordOutcome> = IntentionKind<
  TGoal,
  Beliefs,
  WarlordOutcome
>;

type WarlordPlan<TGoal extends WarlordOutcome> = Plan<
  TGoal,
  Beliefs,
  WarlordOutcome
>;

type WarlordPlanRun = PlanRun<Beliefs, WarlordOutcome>;

type WarlordIntention = Intention<WarlordOutcome, Beliefs, WarlordOutcome>;
