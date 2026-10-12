import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3TimerApi from '@lib/warcraft3-api/timer';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import {
  ActorControlPolicy,
  createActorControlArbiter,
  createBeliefsRuntime,
} from '@lib/bdi';
import { debug } from './debug';
import type { Actor, ActorControlRequest } from './contracts/actor-control';
import { WarlordUpdateChild } from './execution';
import { createCommonBeliefsModel } from './beliefs/common.beliefs';
import { APPLY_PRESSURE } from './desires/apply-pressure';
import { PROTECT_ECONOMIC_ASSETS } from './desires/protect-economic-assets';
import { USE_MILITARY_ASSETS_EFFECTIVELY } from './desires/use-military-assets-effectively';
import {
  createDeliberation,
  AssembledIntention,
} from './deliberation/deliberation';

export { startRuntime };

const TickSeconds = 0.1;
// Every desire is held for the whole game for now.
const Desires = [
  APPLY_PRESSURE,
  PROTECT_ECONOMIC_ASSETS,
  USE_MILITARY_ASSETS_EFFECTIVELY,
];

/**
 * An uncontrolled Actor is granted to any request; one controlled normally
 * only to a preemptive request; one controlled preemptively to none.
 */
const actorControlPolicy: ActorControlPolicy<ActorControlRequest> = ({
  request,
  currentClaim,
}) =>
  currentClaim === null ||
  (request === 'preemptive' && currentClaim.request !== 'preemptive');

/**
 * Runs the bot's BDI loop for one player, from the first tick until the game
 * is won.
 *
 * Each tick revises the Common Beliefs, deliberates on them, then makes the
 * assembled Intentions and their children the managed component tree, whose
 * Scoped Beliefs the beliefs runtime revises before any component updates.
 *
 * Every Plan and Controller update runs through the actor control arbiter,
 * which scopes its control to it; at the end of the tick, components gone
 * from the tree lose their Scoped Beliefs and control.
 */
function startRuntime({ bot }: { bot: W3PlayerApi.player }) {
  const beliefs = createBeliefsRuntime({
    commonModel: createCommonBeliefsModel({ bot }),
  });
  const deliberation = createDeliberation();
  const arbiter = createActorControlArbiter<Actor, ActorControlRequest>({
    policy: actorControlPolicy,
  });
  const loop = W3TimerApi.CreateTimer();
  let intentions: readonly AssembledIntention[] = [];

  const updateChild: WarlordUpdateChild = ({ child }) =>
    arbiter.update({
      source: child,
      run: ({ actorControl }) =>
        child.update({
          beliefs: beliefs.beliefsOf({ component: child }),
          actorControl,
        }),
    });

  const tick = () => {
    const { commonBeliefs } = beliefs.reviseCommon();

    if (commonBeliefs.enemyPlayersPlaying === 0) {
      stopLoop({ loop });
      return;
    }

    ({ intentions } = deliberation.deliberate({
      beliefs: commonBeliefs,
      desires: Desires,
      intentions,
    }));
    beliefs.sync({ roots: intentions });

    for (const intention of intentions) {
      intention.component.update({
        beliefs: beliefs.beliefsOf({ component: intention.component }),
        updateChild,
      });
    }

    const { managedComponents } = beliefs.prune();

    arbiter.releaseInactive({ activeSources: managedComponents });
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
