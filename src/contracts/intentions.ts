import type {
  Force,
  Grant,
  Intention,
  IntentionKind,
  Money,
  Needs,
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
  type WarlordResource,
  type WarlordMoney,
  type WarlordUnitNeed,
  type WarlordNeeds,
  type WarlordForce,
  type WarlordGrant,
};

/** The kind of the Intentions pursuing outcomes of type `TGoal`. */
type WarlordIntentionKind<TGoal extends WarlordOutcome> = IntentionKind<
  TGoal,
  Beliefs,
  WarlordOutcome,
  UnitId,
  WarlordResource
>;

type WarlordPlan<TGoal extends WarlordOutcome> = Plan<
  TGoal,
  Beliefs,
  WarlordOutcome,
  UnitId,
  WarlordResource
>;

type WarlordPlanRun = PlanRun<Beliefs, WarlordOutcome, UnitId, WarlordResource>;

type WarlordIntention = Intention<
  WarlordOutcome,
  Beliefs,
  WarlordOutcome,
  UnitId,
  WarlordResource
>;

/** The resources Allocation hands out with the units. */
type WarlordResource = 'gold' | 'lumber';

type WarlordMoney = Money<WarlordResource>;

type WarlordUnitNeed = UnitNeed<UnitId>;

type WarlordNeeds = Needs<UnitId, WarlordResource>;

type WarlordForce = Force<UnitId, WarlordResource>;

type WarlordGrant = Grant<WarlordOutcome, Beliefs, UnitId, WarlordResource>;
