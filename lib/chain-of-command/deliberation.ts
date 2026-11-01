import { type Desire, strongerFirst } from './desires';
import {
  Intention,
  type IntentionEvent,
  type IntentionKind,
} from './intention';

export { type Deliberation, type DeliberationCycle, createDeliberation };

interface DeliberationDeliberateArgs<TOutcome, TBeliefs> {
  // The cycle's Desires, from every source.
  desires: readonly Desire<TOutcome>[];
  beliefs: TBeliefs;
}

interface DeliberationCycle<TOutcome, TBeliefs, TUnit> {
  /**
   * The unfinished Intentions, by their Desires' rank, then weight, then
   * adoption order: the order in which they are stepped.
   */
  readonly agenda: readonly Intention<TOutcome, TBeliefs, TOutcome, TUnit>[];
  readonly events: readonly IntentionEvent[];
}

/** Decides which Intentions the agent pursues, and owns their lifecycle. */
interface Deliberation<TOutcome, TBeliefs, TUnit> {
  /**
   * Runs one deliberation cycle. An Intention is dropped when its Desire is
   * gone or vetoed, and finished when its kind's achieved or impossible
   * condition holds; its pause condition pauses and resumes it. A valid
   * Desire without an Intention, one weighing more than 0 whose outcome is
   * neither achieved nor impossible, gets an Intention of its outcome's
   * kind, unless its last Intention gave up and it has not lapsed since: no
   * source has proposed it for a cycle.
   */
  deliberate({
    desires,
    beliefs,
  }: DeliberationDeliberateArgs<TOutcome, TBeliefs>): DeliberationCycle<
    TOutcome,
    TBeliefs,
    TUnit
  >;
}

interface CreateDeliberationArgs<TOutcome, TBeliefs, TUnit> {
  // The kind of Intention that pursues the outcome.
  kindOf: ({
    outcome,
  }: {
    outcome: TOutcome;
  }) => IntentionKind<TOutcome, TBeliefs, TOutcome, TUnit>;
}

function createDeliberation<TOutcome, TBeliefs, TUnit>({
  kindOf,
}: CreateDeliberationArgs<TOutcome, TBeliefs, TUnit>): Deliberation<
  TOutcome,
  TBeliefs,
  TUnit
> {
  let agenda: Intention<TOutcome, TBeliefs, TOutcome, TUnit>[] = [];
  let lastSequence = 0;
  // The Desires whose last Intention gave up.
  const mustLapse = new Set<string>();

  return {
    deliberate({ desires, beliefs }) {
      const events: IntentionEvent[] = [];
      const desiresById = new Map<string, Desire<TOutcome>>();

      for (const desire of desires) {
        desiresById.set(desire.id, desire);
      }

      for (const intention of agenda) {
        if (intention.gaveUp) {
          mustLapse.add(intention.desireId);
        }
      }

      for (const id of [...mustLapse]) {
        if (!desiresById.has(id)) {
          mustLapse.delete(id);
        }
      }

      const retained: AgendaEntry<TOutcome, TBeliefs, TUnit>[] = [];

      for (const intention of agenda) {
        const desire = desiresById.get(intention.desireId);
        const event = reconsider({ intention, desire, beliefs });

        if (event) {
          events.push(event);
        }

        if (desire && intention.status !== 'finished') {
          retained.push({ intention, desire });
        }
      }

      for (const desire of desires) {
        if (
          desire.best.weight <= 0 ||
          mustLapse.has(desire.id) ||
          retained.some(({ intention }) => intention.desireId === desire.id)
        ) {
          continue;
        }

        const kind = kindOf({ outcome: desire.outcome });
        const conditionArgs = { goal: desire.outcome, beliefs };

        if (
          (kind.achieved?.(conditionArgs) ?? null) !== null ||
          (kind.impossible?.(conditionArgs) ?? null) !== null
        ) {
          continue;
        }

        lastSequence += 1;

        const intention = new Intention({
          desireId: desire.id,
          goal: desire.outcome,
          kind,
          sequence: lastSequence,
        });
        const paused = kind.paused?.(conditionArgs) ?? null;

        events.push({
          intention: desire.id,
          change: 'adopted',
          reason: desire.best.reason,
        });

        if (paused !== null) {
          events.push(intention.pause({ reason: paused }));
        }

        retained.push({ intention, desire });
      }

      retained.sort((a, b) => agendaOrder(a, b));
      agenda = retained.map(({ intention }) => intention);

      return { agenda, events };
    },
  };
}

interface AgendaEntry<TOutcome, TBeliefs, TUnit> {
  intention: Intention<TOutcome, TBeliefs, TOutcome, TUnit>;
  desire: Desire<TOutcome>;
}

// Adoption order settles ties, since Lua's sort is not stable.
function agendaOrder<TOutcome, TBeliefs, TUnit>(
  a: AgendaEntry<TOutcome, TBeliefs, TUnit>,
  b: AgendaEntry<TOutcome, TBeliefs, TUnit>
): number {
  const byStrength = strongerFirst(a.desire.best, b.desire.best);

  return byStrength !== 0
    ? byStrength
    : a.intention.sequence - b.intention.sequence;
}

interface ReconsiderArgs<TOutcome, TBeliefs, TUnit> {
  intention: Intention<TOutcome, TBeliefs, TOutcome, TUnit>;
  desire: Desire<TOutcome> | undefined;
  beliefs: TBeliefs;
}

// An Intention that finished while it was stepped leaves the agenda without
// an event, since its step already reported the change.
function reconsider<TOutcome, TBeliefs, TUnit>({
  intention,
  desire,
  beliefs,
}: ReconsiderArgs<TOutcome, TBeliefs, TUnit>): IntentionEvent | undefined {
  if (intention.status === 'finished') {
    return undefined;
  }

  if (!desire) {
    return intention.finish({
      result: 'dropped',
      reason: 'no longer proposed',
    });
  }

  if (desire.best.weight <= 0) {
    return intention.finish({
      result: 'dropped',
      reason: `vetoed: ${desire.best.reason}`,
    });
  }

  const { kind } = intention;
  const conditionArgs = { goal: intention.goal, beliefs };
  const achieved = kind.achieved?.(conditionArgs) ?? null;

  if (achieved !== null) {
    return intention.finish({ result: 'achieved', reason: achieved });
  }

  const impossible = kind.impossible?.(conditionArgs) ?? null;

  if (impossible !== null) {
    return intention.finish({ result: 'failed', reason: impossible });
  }

  const paused = kind.paused?.(conditionArgs) ?? null;

  if (paused !== null) {
    return intention.status === 'active'
      ? intention.pause({ reason: paused })
      : undefined;
  }

  return intention.status === 'paused' && !intention.waitingToRecur
    ? intention.resume({ reason: 'its pause condition no longer holds' })
    : undefined;
}
