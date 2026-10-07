import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TimerApi from "@lib/warcraft3-api/timer";
import * as WarlordApi from "@lib/warcraft3-api/warlord";
import { BeliefContainer, requiredBeliefModels, reviseBeliefs } from "@lib/bdi";
import { debug } from "./debug";
import { createCommonBeliefModel } from "./beliefs/common.beliefs";
import { ApplyPressure } from "./desires/apply-pressure";
import { ProtectEconomicAssets } from "./desires/protect-economic-assets";
import { UseMilitaryAssetsEffectively } from "./desires/use-military-assets-effectively";
import {
  createDeliberation,
  WarlordIntention,
} from "./deliberation/deliberation";

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
 * Each tick revises the common Beliefs, deliberates on them, then revises the
 * scoped Beliefs the resulting Intentions require. The container from that
 * second revision is the tick's snapshot every Intention updates from.
 */
export function startRuntime(bot: W3PlayerApi.player) {
  const common = createCommonBeliefModel(bot);
  const coreModels = [common];
  const deliberation = createDeliberation(common);
  const loop = W3TimerApi.CreateTimer();
  let beliefs: BeliefContainer | undefined;
  let intentions: readonly WarlordIntention[] = [];

  const tick = () => {
    const core = reviseBeliefs(coreModels, beliefs);

    if (core.get(common).enemyPlayersPlaying === 0) {
      stopLoop(loop);
      return;
    }

    intentions = deliberation.deliberate(core, DESIRES, intentions);

    const current = reviseBeliefs(
      requiredBeliefModels(intentions),
      beliefs,
      core,
    );
    beliefs = current;

    for (const intention of intentions) {
      intention.update(current);
    }
  };

  W3TimerApi.TimerStart(loop, TICK_SECONDS, true, WarlordApi.guard(tick));
  tick();
}

// With every enemy defeated there is nothing left to play for, and the
// tower rush cannot run without an enemy.
function stopLoop(loop: W3TimerApi.timer) {
  W3TimerApi.PauseTimer(loop);
  W3TimerApi.DestroyTimer(loop);
  debug("Game won; Warlord AI stops.");
}
