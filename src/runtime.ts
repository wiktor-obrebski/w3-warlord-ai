import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3TimerApi from '@lib/warcraft3-api/timer';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import { createBeliefsRuntime } from '@lib/bdi';
import { debug } from './debug';
import type { WarlordUpdateChild } from './contracts/component';
import type { WarlordDesire } from './contracts/desires';
import type { Strategy } from './contracts/strategy';
import { createActorControl } from './capabilities/actor-control/actor-control';
import {
  CommonBeliefs,
  createCommonBeliefsModel,
} from './beliefs/common.beliefs';
import { createDesires } from './desires/desires';
import {
  createDeliberation,
  AssembledIntention,
} from './deliberation/deliberation';

export { startRuntime };

const TickSeconds = 0.1;

/**
 * Runs the bot's BDI loop for one player, from the first tick until the game
 * is won.
 *
 * Each tick revises the Common Beliefs, generates the current Desires,
 * deliberates on them, then makes the assembled Intentions and their
 * children the managed component tree, whose Scoped Beliefs the beliefs
 * runtime revises before any component updates. The strategy Deliberation
 * commits to enters the Common Beliefs on the next tick.
 *
 * Every Intention update runs through Option Generation, whose desire
 * expression then acts for it; Desires it expresses appear on the next
 * tick, so one tick never adopts Intentions for Desires expressed during
 * it. Every Plan and Controller update runs through the actor control
 * arbiter, whose actor control, given to every component as a capability,
 * then acts for it. At the end of the tick, components gone from the tree
 * lose their Scoped Beliefs, control, and desire supports.
 */
function startRuntime({ bot }: { bot: W3PlayerApi.player }) {
  let currentStrategy: Strategy | null = null;
  const beliefs = createBeliefsRuntime({
    commonModel: createCommonBeliefsModel({
      bot,
      readCurrentStrategy: () => currentStrategy,
    }),
  });
  const optionGeneration = createDesires({ tickSeconds: TickSeconds });
  const arbiter = createActorControl();
  const deliberation = createDeliberation({
    actorControl: arbiter.actorControl,
    desireExpression: optionGeneration.desireExpression,
  });
  const loop = W3TimerApi.CreateTimer();
  let desires: readonly WarlordDesire[] = [];
  let intentions: readonly AssembledIntention[] = [];

  const updateChild: WarlordUpdateChild<CommonBeliefs> = ({ child }) =>
    arbiter.update({
      source: child,
      run: () =>
        child.update({ beliefs: beliefs.beliefsOf({ component: child }) }),
    });

  const tick = () => {
    const { commonBeliefs } = beliefs.reviseCommon();
    const now = commonBeliefs.time;

    if (commonBeliefs.enemyPlayersPlaying === 0) {
      stopLoop({ loop });
      return;
    }

    const previousDesires = desires;

    ({ desires } = optionGeneration.generate({ now }));
    reportDesireChanges({ previousDesires, desires });

    ({ intentions } = deliberation.deliberate({
      beliefs: commonBeliefs,
      desires,
      intentions,
    }));
    currentStrategy = deliberation.currentStrategy();
    beliefs.sync({ roots: intentions });

    for (const { component } of intentions) {
      optionGeneration.update({
        source: component,
        now,
        run: () =>
          component.update({
            beliefs: beliefs.beliefsOf({ component }),
            updateChild,
          }),
      });
    }

    const { managedComponents } = beliefs.prune();

    arbiter.releaseInactive({ activeSources: managedComponents });
    optionGeneration.releaseInactive({ activeSources: managedComponents });
  };

  W3TimerApi.TimerStart(loop, TickSeconds, true, WarlordApi.guard(tick));
  tick();
}

// With every enemy defeated there is nothing left to play for, and the
// tower rush cannot run without an enemy.
function stopLoop({ loop }: { loop: W3TimerApi.timer }) {
  W3TimerApi.PauseTimer(loop);
  W3TimerApi.DestroyTimer(loop);
  debug({ message: 'Game won; Warlord AI stops.' });
}

interface ReportDesireChangesArgs {
  previousDesires: readonly WarlordDesire[];
  desires: readonly WarlordDesire[];
}

function reportDesireChanges({
  previousDesires,
  desires,
}: ReportDesireChangesArgs) {
  for (const desire of previousDesires) {
    if (!desires.includes(desire)) {
      debug({ message: `Desire gone: ${desire.id}` });
    }
  }

  for (const desire of desires) {
    if (!previousDesires.includes(desire)) {
      debug({ message: `Desire appeared: ${desire.id}` });
    }
  }
}
