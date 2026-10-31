import {
  collectDesires,
  createDeliberation,
  type IntentionEvent,
  type ProposalSource,
} from '@lib/chain-of-command';
import type { Random } from '@lib/math';
import type { Beliefs } from '../contracts/beliefs';
import type { WarlordDesire, WarlordOutcome } from '../contracts/desires';
import type { WarlordIntention } from '../contracts/intentions';
import type { Observations } from '../contracts/observations';
import type { TicketedOrder } from '../contracts/orders';
import type { WarcraftProbes } from '../contracts/probes';
import type {
  DecisionRecord,
  DecisionRecorder,
  RecordNote,
} from '../contracts/record';
import type { Knowledge } from '../knowledge/knowledge';
import { createActorControl } from '../capabilities/actor-control/actor-control';
import { reviseBeliefs } from '../beliefs/beliefs';
import { proposeConcerns } from '../desires/concerns';
import { identifyOutcome } from '../desires/desires';
import { createIntentionKinds } from '../deliberation/intention-kinds';
import {
  WorkerSafetyController,
  WorkerSafetyControllerCapabilities,
} from '../reflexes/worker-safety/worker-safety.ctrl';
import {
  noteAgendaChange,
  noteDesireChanges,
  noteIntentionEvents,
} from './deliberation-notes';
import { createMindOrders } from './mind-orders';

export { type Mind, type MindStep, createMind };

interface MindStepArgs {
  observations: Observations;
}

/** All of the bot's reasoning, between Perception and the order executor. */
interface Mind {
  /** Decides what to do now, given what Perception reports. */
  step({ observations }: MindStepArgs): MindStep;
}

interface MindStep {
  readonly orders: readonly TicketedOrder[];
  readonly record: DecisionRecord;
}

interface CreateMindArgs {
  knowledge: Knowledge;
  random: Random;
  probes: WarcraftProbes;
}

/**
 * Creates the mind for one game. Each step:
 *
 * 1. revises the Beliefs from the observations;
 * 2. steps worker safety, so it takes attacked workers over before anything
 *    else orders them;
 * 3. runs a deliberation cycle once a second: it collects the Desires the
 *    concerns and the Intentions propose, and deliberates on them;
 * 4. steps the Intentions on the agenda, in its order, each at its kind's
 *    pace.
 *
 * Adopting or ending an Intention changes what is proposed, so the next
 * cycle comes on the next step instead. Units are ordered under actor
 * control: worker safety and each Intention request the units they order,
 * and lose their control once they are gone.
 */
function createMind({ random, probes }: CreateMindArgs): Mind {
  let notes: RecordNote[] = [];
  const recorder: DecisionRecorder = {
    note(note) {
      notes.push(note);
    },
  };
  const orders = createMindOrders({ probes, recorder });
  const arbiter = createActorControl();
  const workerSafetyCapabilitiesProvider: WorkerSafetyControllerCapabilities = {
    actorControl: arbiter.actorControl,
    orders: orders.queue,
    probes: orders.probes,
    recorder,
    random,
  };
  const workerSafety = new WorkerSafetyController({
    capabilities: workerSafetyCapabilitiesProvider,
  });
  const kindOf = createIntentionKinds({
    actorControl: arbiter.actorControl,
    orders: orders.queue,
    probes: orders.probes,
    recorder,
    random,
  });
  const deliberation = createDeliberation<WarlordOutcome, Beliefs>({
    kindOf: ({ outcome }) => kindOf({ outcome }),
  });
  let previousBeliefs: Beliefs | undefined;
  let desires: readonly WarlordDesire[] = [];
  let agenda: readonly WarlordIntention[] = [];
  // Undefined until the first cycle, which comes at once.
  let nextCycleAt: number | undefined;

  return {
    step({ observations }) {
      orders.startStep({ refusedOrders: observations.refusedOrders });

      const beliefs = reviseBeliefs({
        previous: previousBeliefs,
        observations,
      });
      const now = beliefs.time;

      previousBeliefs = beliefs;
      arbiter.update({
        source: workerSafety,
        run: () => workerSafety.update({ beliefs }),
      });

      if (nextCycleAt === undefined || now >= nextCycleAt) {
        const previousDesires = desires;
        const previousAgenda = agenda;

        desires = collectDesires({
          sources: [
            ...proposeConcerns({ beliefs }),
            ...requestsOf({ agenda, beliefs }),
          ],
          identify: ({ outcome }) => identifyOutcome({ outcome }),
        });
        noteDesireChanges({ previousDesires, desires, recorder });

        const cycle = deliberation.deliberate({ desires, beliefs });

        agenda = cycle.agenda;
        noteIntentionEvents({ events: cycle.events, recorder });
        noteAgendaChange({ previousAgenda, agenda, recorder });
        nextCycleAt = changesProposals({ events: cycle.events })
          ? now
          : now + CycleSeconds;
      }

      for (const intention of agenda) {
        arbiter.update({
          source: intention,
          run: () => {
            const events = intention.step({ beliefs, now });

            noteIntentionEvents({ events, recorder });

            if (changesProposals({ events })) {
              nextCycleAt = now;
            }
          },
        });
      }

      arbiter.releaseInactive({
        activeSources: new Set<object>([
          workerSafety,
          ...agenda.filter((intention) => intention.status !== 'finished'),
        ]),
      });

      const record: DecisionRecord = { notes };
      notes = [];

      return { orders: orders.takeOrders(), record };
    },
  };
}

const CycleSeconds = 1;

interface RequestsOfArgs {
  agenda: readonly WarlordIntention[];
  beliefs: Beliefs;
}

function requestsOf({
  agenda,
  beliefs,
}: RequestsOfArgs): ProposalSource<WarlordOutcome>[] {
  return agenda.map((intention) => ({
    name: `Intention ${intention.desireId}`,
    proposals: intention.requests({ beliefs }),
  }));
}

function changesProposals({
  events,
}: {
  events: readonly IntentionEvent[];
}): boolean {
  return events.some(
    ({ change }) =>
      change === 'adopted' ||
      change === 'achieved' ||
      change === 'failed' ||
      change === 'dropped'
  );
}
