import type {
  DirectiveStatuses,
  Force,
  Grant,
  Intention,
  IntentionKind,
  IntentionStep,
  Money,
  Needs,
  Plan,
  PlanRun,
  PlanRunNeedsArgs,
  PlanRunStepArgs,
  PlanStep,
  UnitNeed,
} from '@lib/chain-of-command';
import type { Beliefs } from './beliefs';
import type { WarlordOutcome } from './desires';
import type { Directive } from './directives';
import type { UnitId } from './ids';

export {
  type WarlordIntentionKind,
  type WarlordPlan,
  type WarlordPlanRun,
  type WarlordPlanRunNeedsArgs,
  type WarlordPlanRunStepArgs,
  type WarlordPlanStep,
  type WarlordIntention,
  type WarlordIntentionStep,
  type WarlordDirectiveStatuses,
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
  WarlordResource,
  Directive
>;

type WarlordPlan<TGoal extends WarlordOutcome> = Plan<
  TGoal,
  Beliefs,
  WarlordOutcome,
  UnitId,
  WarlordResource,
  Directive
>;

type WarlordPlanRun = PlanRun<
  Beliefs,
  WarlordOutcome,
  UnitId,
  WarlordResource,
  Directive
>;

type WarlordPlanRunNeedsArgs = PlanRunNeedsArgs<Beliefs, Directive>;

type WarlordPlanRunStepArgs = PlanRunStepArgs<
  Beliefs,
  UnitId,
  WarlordResource,
  Directive
>;

type WarlordPlanStep = PlanStep<Directive>;

type WarlordIntention = Intention<
  WarlordOutcome,
  Beliefs,
  WarlordOutcome,
  UnitId,
  WarlordResource,
  Directive
>;

type WarlordIntentionStep = IntentionStep<Directive>;

type WarlordDirectiveStatuses = DirectiveStatuses<Directive>;

/** The resources Allocation hands out with the units. */
type WarlordResource = 'gold' | 'lumber';

type WarlordMoney = Money<WarlordResource>;

type WarlordUnitNeed = UnitNeed<UnitId>;

type WarlordNeeds = Needs<UnitId, WarlordResource>;

type WarlordForce = Force<UnitId, WarlordResource>;

type WarlordGrant = Grant<
  WarlordOutcome,
  Beliefs,
  UnitId,
  WarlordResource,
  Directive
>;
