import type {
  Force,
  Grant,
  Intention,
  IntentionKind,
  Plan,
  PlanRun,
  UnitNeed,
} from '@lib/chain-of-command';
import type { Beliefs } from './beliefs';
import type { WarlordOutcome } from './desires';
import type { UnitId } from './ids';

export {
  type WarlordIntentionKind,
  type WarlordPlan,
  type WarlordPlanRun,
  type WarlordIntention,
  type WarlordUnitNeed,
  type WarlordForce,
  type WarlordGrant,
};

/** The kind of the Intentions pursuing outcomes of type `TGoal`. */
type WarlordIntentionKind<TGoal extends WarlordOutcome> = IntentionKind<
  TGoal,
  Beliefs,
  WarlordOutcome,
  UnitId
>;

type WarlordPlan<TGoal extends WarlordOutcome> = Plan<
  TGoal,
  Beliefs,
  WarlordOutcome,
  UnitId
>;

type WarlordPlanRun = PlanRun<Beliefs, WarlordOutcome, UnitId>;

type WarlordIntention = Intention<
  WarlordOutcome,
  Beliefs,
  WarlordOutcome,
  UnitId
>;

type WarlordUnitNeed = UnitNeed<UnitId>;

type WarlordForce = Force<UnitId>;

type WarlordGrant = Grant<WarlordOutcome, Beliefs, UnitId>;
