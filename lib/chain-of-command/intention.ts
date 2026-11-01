import type { Force, Needs } from './allocation';
import type { Proposal } from './desires';

export {
  type IntentionKind,
  type IntentionConditionArgs,
  type Plan,
  type PlanRun,
  type PlanRunNeedsArgs,
  type PlanRunStepArgs,
  type PlanStep,
  type DirectiveStatus,
  type DirectiveStatuses,
  type FailurePolicy,
  type IntentionStatus,
  type IntentionChange,
  type IntentionEvent,
  type IntentionStep,
  Intention,
};

interface IntentionConditionArgs<TGoal, TBeliefs> {
  goal: TGoal;
  beliefs: TBeliefs;
}

/**
 * The declaration behind the Intentions pursuing one kind of outcome. Each
 * condition returns its reason while it holds, and null otherwise; an
 * omitted condition never holds.
 */
interface IntentionKind<
  TGoal,
  TBeliefs,
  TOutcome,
  TUnit,
  TResource extends string,
  TDirective,
> {
  // How often an Intention of the kind is stepped, in seconds.
  readonly paceSeconds: number;
  readonly plans: readonly Plan<
    TGoal,
    TBeliefs,
    TOutcome,
    TUnit,
    TResource,
    TDirective
  >[];
  readonly failure: FailurePolicy;

  achieved?({
    goal,
    beliefs,
  }: IntentionConditionArgs<TGoal, TBeliefs>): string | null;

  impossible?({
    goal,
    beliefs,
  }: IntentionConditionArgs<TGoal, TBeliefs>): string | null;

  // While it holds, the Intention waits, keeping its state.
  paused?({
    goal,
    beliefs,
  }: IntentionConditionArgs<TGoal, TBeliefs>): string | null;
}

/** One way to pursue an Intention. Each attempt at it is a run. */
interface Plan<
  TGoal,
  TBeliefs,
  TOutcome,
  TUnit,
  TResource extends string,
  TDirective,
> {
  readonly name: string;
  // Of the applicable plans, the one with the highest preference runs; on a
  // tie, the one listed first.
  readonly preference: number;

  applicable({
    goal,
    beliefs,
  }: IntentionConditionArgs<TGoal, TBeliefs>): boolean;

  start({
    goal,
    beliefs,
  }: IntentionConditionArgs<TGoal, TBeliefs>): PlanRun<
    TBeliefs,
    TOutcome,
    TUnit,
    TResource,
    TDirective
  >;
}

/**
 * How a Directive is going: pending until its unit starts carrying it out,
 * underway while the unit does, done once it has, and failed when it could
 * not.
 */
type DirectiveStatus = 'pending' | 'underway' | 'done' | 'failed';

/**
 * The status of each Directive in effect, keyed by the Directive itself, so
 * that a run looks up the ones it gave. A Directive another one replaced is
 * no longer in effect.
 */
type DirectiveStatuses<TDirective> = ReadonlyMap<TDirective, DirectiveStatus>;

interface PlanRunNeedsArgs<TBeliefs, TDirective> {
  beliefs: TBeliefs;
  directiveStatuses: DirectiveStatuses<TDirective>;
}

interface PlanRunStepArgs<
  TBeliefs,
  TUnit,
  TResource extends string,
  TDirective,
> {
  beliefs: TBeliefs;
  // The units and money Allocation last granted for the run's needs.
  force: Force<TUnit, TResource>;
  directiveStatuses: DirectiveStatuses<TDirective>;
}

/**
 * One attempt at a plan, stepped at its Intention's pace. Its step is data
 * in and data out: it reads its force and how the Directives it gave are
 * going, and returns the Directives it gives now.
 */
interface PlanRun<
  TBeliefs,
  TOutcome,
  TUnit,
  TResource extends string,
  TDirective,
> {
  step({
    beliefs,
    force,
    directiveStatuses,
  }: PlanRunStepArgs<
    TBeliefs,
    TUnit,
    TResource,
    TDirective
  >): PlanStep<TDirective>;

  /** The units and money the run needs now, asked every Allocation round. */
  needs?({
    beliefs,
    directiveStatuses,
  }: PlanRunNeedsArgs<TBeliefs, TDirective>): Needs<TUnit, TResource>;

  /**
   * The Desires the run proposes for goals its Intention depends on but does
   * not pursue itself, asked every deliberation cycle.
   */
  requests?({ beliefs }: { beliefs: TBeliefs }): readonly Proposal<TOutcome>[];
}

/**
 * The run's status, and the Directives it gives units of its force, each
 * replacing the unit's current one; none when absent.
 */
type PlanStep<TDirective> = (
  | { readonly status: 'running' }
  | { readonly status: 'succeeded' | 'failed'; readonly reason: string }
) & { readonly directives?: readonly TDirective[] };

/**
 * How an Intention kind handles failed plans. A failed plan is excluded for
 * `excludeSeconds`. After `attempts` failed runs, or when no plan applies,
 * the Intention is exhausted: it recurs, trying again `excludeSeconds`
 * later, or it fails, giving up until its Desire lapses.
 */
interface FailurePolicy {
  readonly excludeSeconds: number;
  readonly attempts: number;
  readonly whenExhausted: 'recur' | 'fail';
}

type IntentionStatus = 'active' | 'paused' | 'finished';

type IntentionChange =
  | 'adopted'
  | 'paused'
  | 'resumed'
  | 'achieved'
  | 'failed'
  | 'dropped'
  | 'planStarted'
  | 'planSucceeded'
  | 'planFailed';

/** A change in an Intention, with its reason where it has one. */
interface IntentionEvent {
  // The id of the Desire the Intention pursues.
  readonly intention: string;
  readonly change: IntentionChange;
  readonly plan?: string;
  readonly reason?: string;
}

/** What stepping an Intention changed, and the Directives its run gave. */
interface IntentionStep<TDirective> {
  readonly events: IntentionEvent[];
  readonly directives: readonly TDirective[];
}

interface IntentionConstructorArgs<
  TGoal,
  TBeliefs,
  TOutcome,
  TUnit,
  TResource extends string,
  TDirective,
> {
  desireId: string;
  goal: TGoal;
  kind: IntentionKind<TGoal, TBeliefs, TOutcome, TUnit, TResource, TDirective>;
  // The order of adoption, which breaks ties on the agenda.
  sequence: number;
}

interface IntentionPrepareArgs<TBeliefs> {
  beliefs: TBeliefs;
  now: number;
}

interface IntentionNeedsArgs<TBeliefs, TDirective> {
  beliefs: TBeliefs;
  directiveStatuses: DirectiveStatuses<TDirective>;
}

interface IntentionStepArgs<
  TBeliefs,
  TUnit,
  TResource extends string,
  TDirective,
> {
  beliefs: TBeliefs;
  now: number;
  force: Force<TUnit, TResource>;
  directiveStatuses: DirectiveStatuses<TDirective>;
}

interface IntentionPauseArgs {
  reason: string;
  // When to try again, for an Intention waiting to recur.
  until?: number;
}

interface IntentionFinishArgs {
  result: 'achieved' | 'failed' | 'dropped';
  reason: string;
  gaveUp?: boolean;
}

interface IntentionChoosePlanArgs<TBeliefs> {
  beliefs: TBeliefs;
  now: number;
}

interface IntentionStartPlanArgs<TBeliefs> {
  beliefs: TBeliefs;
  now: number;
}

interface IntentionExhaustArgs {
  reason: string;
  now: number;
}

/**
 * A commitment to one Desire, pursued through its kind's plans. Preparing and
 * stepping it is the generic means-end reasoning: preparing chooses the best
 * applicable plan, and stepping steps its run at the kind's pace and applies
 * the failure policy when a run fails. Deliberation pauses, resumes, and
 * finishes it.
 */
class Intention<
  TGoal,
  TBeliefs,
  TOutcome,
  TUnit,
  TResource extends string,
  TDirective,
> {
  public readonly desireId: string;
  public readonly goal: TGoal;
  public readonly kind: IntentionKind<
    TGoal,
    TBeliefs,
    TOutcome,
    TUnit,
    TResource,
    TDirective
  >;
  public readonly sequence: number;
  private currentStatus: IntentionStatus = 'active';
  private finishedGivingUp = false;
  // Set only while waiting to recur, not while a pause condition holds.
  private recurAt: number | undefined;
  private attempt:
    | Attempt<TGoal, TBeliefs, TOutcome, TUnit, TResource, TDirective>
    | undefined;
  private failedRuns = 0;
  private readonly excludedUntil = new Map<
    Plan<TGoal, TBeliefs, TOutcome, TUnit, TResource, TDirective>,
    number
  >();
  // Undefined until the first step, which comes at once.
  private nextStepAt: number | undefined;

  public constructor({
    desireId,
    goal,
    kind,
    sequence,
  }: IntentionConstructorArgs<
    TGoal,
    TBeliefs,
    TOutcome,
    TUnit,
    TResource,
    TDirective
  >) {
    this.desireId = desireId;
    this.goal = goal;
    this.kind = kind;
    this.sequence = sequence;
  }

  public get status(): IntentionStatus {
    return this.currentStatus;
  }

  /** Whether it finished because its failure policy gave up. */
  public get gaveUp(): boolean {
    return this.finishedGivingUp;
  }

  public get waitingToRecur(): boolean {
    return this.recurAt !== undefined;
  }

  /**
   * Readies it for an Allocation round, so that a new run is granted its
   * force before its first step: one waiting to recur resumes once its time
   * has come, and an active one without a run starts the best applicable
   * plan.
   */
  public prepare({
    beliefs,
    now,
  }: IntentionPrepareArgs<TBeliefs>): IntentionEvent[] {
    const events: IntentionEvent[] = [];

    if (
      this.currentStatus === 'paused' &&
      this.recurAt !== undefined &&
      now >= this.recurAt
    ) {
      this.failedRuns = 0;
      events.push(this.resume({ reason: 'trying again' }));
    }

    if (this.currentStatus === 'active' && !this.attempt) {
      events.push(this.startPlan({ beliefs, now }));
    }

    return events;
  }

  /** What its run needs now; nothing while it is paused or finished. */
  public needs({
    beliefs,
    directiveStatuses,
  }: IntentionNeedsArgs<TBeliefs, TDirective>): Needs<TUnit, TResource> {
    if (this.currentStatus !== 'active') {
      return { units: [] };
    }

    return (
      this.attempt?.run.needs?.({ beliefs, directiveStatuses }) ?? {
        units: [],
      }
    );
  }

  /** The Desires its run currently proposes; none once it has finished. */
  public requests({
    beliefs,
  }: {
    beliefs: TBeliefs;
  }): readonly Proposal<TOutcome>[] {
    if (this.currentStatus === 'finished') {
      return [];
    }

    return this.attempt?.run.requests?.({ beliefs }) ?? [];
  }

  /**
   * Steps its run with its force when the kind's pace allows, and returns
   * the Directives the run gives. A run that ends is let go, and the next
   * preparation starts another; a paused or finished Intention is not
   * stepped.
   */
  public step({
    beliefs,
    now,
    force,
    directiveStatuses,
  }: IntentionStepArgs<
    TBeliefs,
    TUnit,
    TResource,
    TDirective
  >): IntentionStep<TDirective> {
    const events: IntentionEvent[] = [];
    const { attempt } = this;

    if (
      this.currentStatus !== 'active' ||
      !attempt ||
      (this.nextStepAt !== undefined && now < this.nextStepAt)
    ) {
      return { events, directives: [] };
    }

    this.nextStepAt = now + this.kind.paceSeconds;

    const planStep = attempt.run.step({ beliefs, force, directiveStatuses });
    const directives = planStep.directives ?? [];

    if (planStep.status === 'running') {
      return { events, directives };
    }

    this.attempt = undefined;

    if (planStep.status === 'succeeded') {
      events.push({
        intention: this.desireId,
        change: 'planSucceeded',
        plan: attempt.plan.name,
        reason: planStep.reason,
      });
      return { events, directives };
    }

    events.push({
      intention: this.desireId,
      change: 'planFailed',
      plan: attempt.plan.name,
      reason: planStep.reason,
    });
    this.excludedUntil.set(
      attempt.plan,
      now + this.kind.failure.excludeSeconds
    );
    this.failedRuns += 1;

    if (this.failedRuns >= this.kind.failure.attempts) {
      events.push(
        this.exhaust({ reason: `${this.failedRuns} failed runs`, now })
      );
    }

    return { events, directives };
  }

  public pause({ reason, until }: IntentionPauseArgs): IntentionEvent {
    this.currentStatus = 'paused';
    this.recurAt = until;

    return { intention: this.desireId, change: 'paused', reason };
  }

  public resume({ reason }: { reason: string }): IntentionEvent {
    this.currentStatus = 'active';
    this.recurAt = undefined;

    return { intention: this.desireId, change: 'resumed', reason };
  }

  public finish({
    result,
    reason,
    gaveUp = false,
  }: IntentionFinishArgs): IntentionEvent {
    this.currentStatus = 'finished';
    this.finishedGivingUp = gaveUp;
    this.attempt = undefined;

    return { intention: this.desireId, change: result, reason };
  }

  // Exhausts the Intention when no plan applies.
  private startPlan({
    beliefs,
    now,
  }: IntentionStartPlanArgs<TBeliefs>): IntentionEvent {
    const plan = this.choosePlan({ beliefs, now });

    if (!plan) {
      return this.exhaust({ reason: 'no plan applies', now });
    }

    this.attempt = { plan, run: plan.start({ goal: this.goal, beliefs }) };

    return { intention: this.desireId, change: 'planStarted', plan: plan.name };
  }

  private choosePlan({
    beliefs,
    now,
  }: IntentionChoosePlanArgs<TBeliefs>):
    | Plan<TGoal, TBeliefs, TOutcome, TUnit, TResource, TDirective>
    | undefined {
    let chosen:
      | Plan<TGoal, TBeliefs, TOutcome, TUnit, TResource, TDirective>
      | undefined;

    for (const plan of this.kind.plans) {
      const excludedUntil = this.excludedUntil.get(plan);
      const excluded = excludedUntil !== undefined && now < excludedUntil;

      if (
        !excluded &&
        plan.applicable({ goal: this.goal, beliefs }) &&
        (!chosen || plan.preference > chosen.preference)
      ) {
        chosen = plan;
      }
    }

    return chosen;
  }

  private exhaust({ reason, now }: IntentionExhaustArgs): IntentionEvent {
    const { whenExhausted, excludeSeconds } = this.kind.failure;

    return whenExhausted === 'recur'
      ? this.pause({
          reason: `${reason}; trying again in ${excludeSeconds} s`,
          until: now + excludeSeconds,
        })
      : this.finish({
          result: 'failed',
          reason: `gave up: ${reason}`,
          gaveUp: true,
        });
  }
}

// The plan an Intention runs, and its run.
interface Attempt<
  TGoal,
  TBeliefs,
  TOutcome,
  TUnit,
  TResource extends string,
  TDirective,
> {
  readonly plan: Plan<TGoal, TBeliefs, TOutcome, TUnit, TResource, TDirective>;
  readonly run: PlanRun<TBeliefs, TOutcome, TUnit, TResource, TDirective>;
}
