import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3TimerApi from '@lib/warcraft3-api/timer';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import { createActorControlArbiter, createBeliefsRuntime } from '@lib/bdi';
import { debug } from './debug';
import { Actor, ActorControlRequest, actorControlPolicy } from './actor';
import { WarlordUpdateChild } from './execution';
import { createCommonBeliefsModel } from './beliefs/common.beliefs';
import { ApplyPressure } from './desires/apply-pressure';
import { ProtectEconomicAssets } from './desires/protect-economic-assets';
import { UseMilitaryAssetsEffectively } from './desires/use-military-assets-effectively';
import {
  createDeliberation,
  ProvidedIntention,
} from './deliberation/deliberation';

const TICK_SECONDS = 0.1;
// Every desire is held for the whole game for now.
const DESIRES = [
  ApplyPressure,
  ProtectEconomicAssets,
  UseMilitaryAssetsEffectively,
];

/**
 * Runs the bot's BDI loop for one player, from the first tick until the game
 * is won.
 *
 * Each tick revises the Common Beliefs, deliberates on them, then makes the
 * provided Intentions and their children the managed component tree, whose
 * Scoped Beliefs the beliefs runtime revises before any component updates.
 *
 * Every Plan and Controller update runs through the actor control arbiter,
 * which scopes its control to it; at the end of the tick, components gone
 * from the tree lose their Scoped Beliefs and control.
 */
export function startRuntime(bot: W3PlayerApi.player) {
  const beliefs = createBeliefsRuntime(createCommonBeliefsModel(bot));
  const deliberation = createDeliberation();
  const arbiter = createActorControlArbiter<Actor, ActorControlRequest>(
    actorControlPolicy
  );
  const loop = W3TimerApi.CreateTimer();
  let intentions: readonly ProvidedIntention[] = [];

  const updateChild: WarlordUpdateChild = (child) =>
    arbiter.update(child, (control) =>
      child.update(beliefs.beliefsOf(child), control)
    );

  const tick = () => {
    const common = beliefs.reviseCommon();

    if (common.enemyPlayersPlaying === 0) {
      stopLoop(loop);
      return;
    }

    intentions = deliberation.deliberate(common, DESIRES, intentions);
    beliefs.sync(intentions);

    for (const intention of intentions) {
      intention.value.update(beliefs.beliefsOf(intention.value), updateChild);
    }

    arbiter.releaseInactive(beliefs.prune());
  };

  W3TimerApi.TimerStart(loop, TICK_SECONDS, true, WarlordApi.guard(tick));
  tick();
}

// With every enemy defeated there is nothing left to play for, and the
// tower rush cannot run without an enemy.
function stopLoop(loop: W3TimerApi.timer) {
  W3TimerApi.PauseTimer(loop);
  W3TimerApi.DestroyTimer(loop);
  debug('Game won; Warlord AI stops.');
}
