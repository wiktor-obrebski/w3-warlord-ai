import { BeliefsRuntime, createBeliefsRuntime } from '@lib/bdi';
import type { Random } from '@lib/math';
import type { WarlordUpdateChild } from '../contracts/component';
import type { WarlordDesire } from '../contracts/desires';
import type { Observations, ObservedWorld } from '../contracts/observations';
import type { TicketedOrder } from '../contracts/orders';
import type { WarcraftProbes } from '../contracts/probes';
import type {
  DecisionRecord,
  DecisionRecorder,
  RecordNote,
} from '../contracts/record';
import type { Strategy } from '../contracts/strategy';
import type { ObservedAttack } from '../contracts/world';
import type { Knowledge } from '../knowledge/knowledge';
import { createActorControl } from '../capabilities/actor-control/actor-control';
import {
  CommonBeliefs,
  createCommonBeliefsModel,
} from '../beliefs/common.beliefs';
import { createDesires } from '../desires/desires';
import {
  createDeliberation,
  AssembledIntention,
} from '../deliberation/deliberation';
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
 * Creates the mind for one game. The first iteration's framework still runs
 * inside it: each step revises the Common Beliefs from the observations,
 * generates the current Desires, deliberates on them, then makes the
 * assembled Intentions and their children the managed component tree, whose
 * Scoped Beliefs the beliefs runtime revises before any component updates.
 * The strategy Deliberation commits to enters the Common Beliefs on the next
 * step.
 *
 * Every Intention update runs through Option Generation, whose desire
 * expression then acts for it; Desires it expresses appear on the next
 * step, so one step never adopts Intentions for Desires expressed during
 * it. Every Plan and Controller update runs through the actor control
 * arbiter, whose actor control, given to every component as a capability,
 * then acts for it. At the end of the step, components gone from the tree
 * lose their Scoped Beliefs, control, and desire supports.
 */
function createMind({ random, probes, tickSeconds }: CreateMindArgs): Mind {
  let world: ObservedWorld | null = null;
  // Each attack reaches the Common Beliefs once, however often they are
  // revised in a step.
  let unobservedAttacks: readonly ObservedAttack[] = [];
  let notes: RecordNote[] = [];
  const recorder: DecisionRecorder = {
    note(note) {
      notes.push(note);
    },
  };
  const orders = createMindOrders({ probes, recorder });
  let currentStrategy: Strategy | null = null;
  const commonModel = createCommonBeliefsModel({
    readObservations: () => {
      if (!world) {
        throw new Error('Mind: beliefs revised before any observation.');
      }

      const attacksStarted = unobservedAttacks;
      unobservedAttacks = [];

      return { world, attacksStarted };
    },
    readCurrentStrategy: () => currentStrategy,
  });
  // The beliefs runtime revises the Common Beliefs as soon as it is created,
  // so it is created on the first step, once there is a world to observe.
  let beliefsRuntime: BeliefsRuntime<CommonBeliefs> | null = null;
  const beliefs = (): BeliefsRuntime<CommonBeliefs> => {
    beliefsRuntime ??= createBeliefsRuntime({ commonModel });

    return beliefsRuntime;
  };
  const optionGeneration = createDesires({ tickSeconds });
  const arbiter = createActorControl();
  const deliberation = createDeliberation({
    actorControl: arbiter.actorControl,
    desireExpression: optionGeneration.desireExpression,
    orders: orders.queue,
    probes: orders.probes,
    recorder,
    random,
  });
  let desires: readonly WarlordDesire[] = [];
  let intentions: readonly AssembledIntention[] = [];

  const updateChild: WarlordUpdateChild<CommonBeliefs> = ({ child }) =>
    arbiter.update({
      source: child,
      run: () =>
        child.update({ beliefs: beliefs().beliefsOf({ component: child }) }),
    });

  return {
    step({ observations }) {
      world = observations.world;
      unobservedAttacks = observations.attacksStarted;
      orders.startStep({ refusedOrders: observations.refusedOrders });

      const { commonBeliefs } = beliefs().reviseCommon();
      const now = commonBeliefs.time;
      const previousDesires = desires;

      ({ desires } = optionGeneration.generate({ now }));
      reportDesireChanges({ previousDesires, desires, recorder });

      ({ intentions } = deliberation.deliberate({
        beliefs: commonBeliefs,
        desires,
        intentions,
      }));
      currentStrategy = deliberation.currentStrategy();
      beliefs().sync({ roots: intentions });

      for (const { component } of intentions) {
        optionGeneration.update({
          source: component,
          now,
          run: () =>
            component.update({
              beliefs: beliefs().beliefsOf({ component }),
              updateChild,
            }),
        });
      }

      const { managedComponents } = beliefs().prune();

      arbiter.releaseInactive({ activeSources: managedComponents });
      optionGeneration.releaseInactive({ activeSources: managedComponents });

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
