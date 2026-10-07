import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TimerApi from "@lib/warcraft3-api/timer";
import { debug } from "./debug";
import { GlobalBeliefModel, GlobalBeliefs } from "./beliefs/global.beliefs";
import { ApplyPressure } from "./desires/apply-pressure";
import { ProtectEconomicAssets } from "./desires/protect-economic-assets";
import { UseMilitaryAssetsEffectively } from "./desires/use-military-assets-effectively";
import {
  WarlordDeliberation,
  WarlordIntention,
} from "./deliberation/deliberation";

declare function guard(this: void, callback: (this: void) => void): (this: void) => void;

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
 */
export function startRuntime(bot: W3PlayerApi.player) {
  const beliefModel = new GlobalBeliefModel(bot);
  const deliberation = new WarlordDeliberation();
  const loop = W3TimerApi.CreateTimer();
  let beliefs: GlobalBeliefs | undefined;
  let intentions: readonly WarlordIntention[] = [];

  const tick = () => {
    const current = beliefModel.revise(beliefs, beliefModel.observe());
    beliefs = current;

    if (current.enemyPlayersPlaying === 0) {
      stopLoop(loop);
      return;
    }

    intentions = deliberation.deliberate(current, DESIRES, intentions);

    for (const intention of intentions) {
      intention.update(current);
    }
  };

  W3TimerApi.TimerStart(loop, TICK_SECONDS, true, guard(tick));
  tick();
}

// With every enemy defeated there is nothing left to play for, and the
// tower rush cannot run without an enemy.
function stopLoop(loop: W3TimerApi.timer) {
  W3TimerApi.PauseTimer(loop);
  W3TimerApi.DestroyTimer(loop);
  debug("Game won; Warlord AI stops.");
}
