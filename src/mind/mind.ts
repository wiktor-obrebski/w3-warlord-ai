import type { Random } from '@lib/math';
import type { Beliefs } from '../contracts/beliefs';
import type {
  AssembledWarlordComponent,
  WarlordUpdateChild,
} from '../contracts/component';
import type { WarlordDesire } from '../contracts/desires';
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
import { createDesires } from '../desires/desires';
import {
  createDeliberation,
  AssembledIntention,
} from '../deliberation/deliberation';
import {
  WorkerSafetyController,
  WorkerSafetyControllerCapabilities,
} from '../reflexes/worker-safety/worker-safety.ctrl';
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
  // How often, in game seconds, the mind is stepped.
  tickSeconds: number;
}

/**
 * Creates the mind for one game. Each step revises the Beliefs from the
 * observations, and runs worker safety first, so it takes attacked workers
 * over before anything else orders them in the same step. Then the first
 * iteration's framework runs on the Beliefs: the step generates the current
 * Desires, deliberates on them, and updates the Intentions, which update
 * their Plans and Controllers.
 *
 * Every Intention update runs through Option Generation, whose desire
 * expression then acts for it; Desires it expresses appear on the next
 * step, so one step never adopts Intentions for Desires expressed during
 * it. Every Plan and Controller update runs through the actor control
 * arbiter, whose actor control, given to every component as a capability,
 * then acts for it. At the end of the step, components no longer among the
 * Intentions and their children lose their control and desire supports.
 */
function createMind({ random, probes, tickSeconds }: CreateMindArgs): Mind {
  let notes: RecordNote[] = [];
  const recorder: DecisionRecorder = {
    note(note) {
      notes.push(note);
    },
  };
  const orders = createMindOrders({ probes, recorder });
  const optionGeneration = createDesires({ tickSeconds });
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
  const deliberation = createDeliberation({
    actorControl: arbiter.actorControl,
    desireExpression: optionGeneration.desireExpression,
    orders: orders.queue,
    probes: orders.probes,
    recorder,
    random,
  });
  let previousBeliefs: Beliefs | undefined;
  let desires: readonly WarlordDesire[] = [];
  let intentions: readonly AssembledIntention[] = [];

  return {
    step({ observations }) {
      orders.startStep({ refusedOrders: observations.refusedOrders });

      const beliefs = reviseBeliefs({
        previous: previousBeliefs,
        observations,
      });
      const now = beliefs.time;
      const previousDesires = desires;

      previousBeliefs = beliefs;
      arbiter.update({
        source: workerSafety,
        run: () => workerSafety.update({ beliefs }),
      });
      ({ desires } = optionGeneration.generate({ now }));
      reportDesireChanges({ previousDesires, desires, recorder });

      ({ intentions } = deliberation.deliberate({
        beliefs,
        desires,
        intentions,
      }));

      const updateChild: WarlordUpdateChild = ({ child }) =>
        arbiter.update({
          source: child,
          run: () => child.update({ beliefs }),
        });

      for (const { component } of intentions) {
        optionGeneration.update({
          source: component,
          now,
          run: () => component.update({ beliefs, updateChild }),
        });
      }

      const activeComponents = componentsInTree({ roots: intentions });

      arbiter.releaseInactive({
        activeSources: new Set([workerSafety, ...activeComponents]),
      });
      optionGeneration.releaseInactive({ activeSources: activeComponents });

      const record: DecisionRecord = { notes };
      notes = [];

      return { orders: orders.takeOrders(), record };
    },
  };
}

interface ReportDesireChangesArgs {
  previousDesires: readonly WarlordDesire[];
  desires: readonly WarlordDesire[];
  recorder: DecisionRecorder;
}

function reportDesireChanges({
  previousDesires,
  desires,
  recorder,
}: ReportDesireChangesArgs) {
  for (const desire of previousDesires) {
    if (!desires.includes(desire)) {
      recorder.note({
        message: `Desire gone: ${desire.id}`,
        fields: { desire: desire.id },
      });
    }
  }

  for (const desire of desires) {
    if (!previousDesires.includes(desire)) {
      recorder.note({
        message: `Desire appeared: ${desire.id}`,
        fields: { desire: desire.id },
      });
    }
  }
}

interface ComponentsInTreeArgs {
  roots: readonly AssembledWarlordComponent<object>[];
}

interface AddTreeArgs {
  assembledComponent: AssembledWarlordComponent<object>;
}

function componentsInTree({ roots }: ComponentsInTreeArgs): Set<object> {
  const components = new Set<object>();
  const addTree = ({ assembledComponent }: AddTreeArgs) => {
    components.add(assembledComponent.component);

    for (const child of assembledComponent.children) {
      addTree({ assembledComponent: child });
    }
  };

  for (const root of roots) {
    addTree({ assembledComponent: root });
  }

  return components;
}
