import {
  allocate,
  collectDesires,
  createDeliberation,
  type IntentionEvent,
  type ProposalSource,
} from '@lib/chain-of-command';
import type { Random } from '@lib/math';
import type { Beliefs } from '../contracts/beliefs';
import type { WarlordDesire, WarlordOutcome } from '../contracts/desires';
import type { UnitId } from '../contracts/ids';
import type {
  WarlordForce,
  WarlordGrant,
  WarlordIntention,
  WarlordResource,
} from '../contracts/intentions';
import type { Observations } from '../contracts/observations';
import type { TicketedOrder } from '../contracts/orders';
import type { WarcraftProbes } from '../contracts/probes';
import type {
  DecisionRecord,
  DecisionRecorder,
  RecordNote,
} from '../contracts/record';
import type { Knowledge } from '../knowledge/knowledge';
import { reviseBeliefs } from '../beliefs/beliefs';
import { proposeConcerns } from '../desires/concerns';
import { identifyOutcome } from '../desires/desires';
import { createIntentionKinds } from '../deliberation/intention-kinds';
import {
  createUnitBehaviors,
  UnitBehaviors,
  UnitBehaviorsCapabilities,
} from '../unit-behaviors/unit-behaviors';
import { noteGrantChanges } from './allocation-notes';
import {
  noteAgendaChange,
  noteDesireChanges,
  noteIntentionEvents,
} from './deliberation-notes';
import { createForceGuard } from './force-guard';
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
 * 2. starts the Unit Behaviors' step: their reflexes claim the units they
 *    protect, and the Directives' progress catches up with the Beliefs;
 * 3. runs a deliberation cycle once a second: it collects the Desires the
 *    concerns and the Intentions propose, and deliberates on them;
 * 4. allocates the units to the Intentions on the agenda, by their needs;
 * 5. steps the Intentions on the agenda, in its order, each at its kind's
 *    pace, with its force, which gives its units Directives;
 * 6. lets the Unit Behaviors order the units.
 *
 * Adopting or ending an Intention changes what is proposed, so the next
 * cycle comes on the next step instead.
 */
function createMind({ random, probes }: CreateMindArgs): Mind {
  let notes: RecordNote[] = [];
  const recorder: DecisionRecorder = {
    note(note) {
      notes.push(note);
    },
  };
  const orders = createMindOrders({ probes, recorder });
  const unitBehaviorsCapabilitiesProvider: UnitBehaviorsCapabilities = {
    orders: orders.queue,
    probes: orders.probes,
    recorder,
    random,
    wasProbed: ({ unit }) => orders.wasProbed({ unit }),
  };
  const unitBehaviors = createUnitBehaviors({
    capabilities: unitBehaviorsCapabilitiesProvider,
  });
  const forceGuard = createForceGuard({
    directives: unitBehaviors.directives,
    probes: orders.probes,
  });
  const kindOf = createIntentionKinds({
    directives: forceGuard.directives,
    probes: forceGuard.probes,
    recorder,
    random,
  });
  const deliberation = createDeliberation<
    WarlordOutcome,
    Beliefs,
    UnitId,
    WarlordResource
  >({
    kindOf: ({ outcome }) => kindOf({ outcome }),
  });
  let previousBeliefs: Beliefs | undefined;
  let desires: readonly WarlordDesire[] = [];
  let agenda: readonly WarlordIntention[] = [];
  let grants: readonly WarlordGrant[] = [];
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
      unitBehaviors.startStep({ beliefs });

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

      const previousGrants = grants;

      grants = allocate({
        agenda,
        units: [...beliefs.self.units.keys()],
        stock: { gold: beliefs.self.gold, lumber: beliefs.self.lumber },
        beliefs,
        now,
      });
      noteGrantChanges({ previousGrants, grants, recorder });

      for (const grant of grants) {
        const force = withoutClaimedUnits({
          force: grant.force,
          unitBehaviors,
        });

        forceGuard.within({
          force,
          run: () => {
            const events = grant.intention.step({ beliefs, now, force });

            noteIntentionEvents({ events, recorder });

            if (changesProposals({ events })) {
              nextCycleAt = now;
            }
          },
        });
      }

      unitBehaviors.decide({ beliefs });

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

interface WithoutClaimedUnitsArgs {
  force: WarlordForce;
  unitBehaviors: UnitBehaviors;
}

// A unit a reflex claimed stays its holder's, but is out of its run's reach
// for the step: a probe orders its unit at once, and would take it from the
// reflex.
function withoutClaimedUnits({
  force,
  unitBehaviors,
}: WithoutClaimedUnitsArgs): WarlordForce {
  return {
    units: new Set(
      [...force.units].filter((unit) => !unitBehaviors.protects({ unit }))
    ),
    money: force.money,
  };
}
