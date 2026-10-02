import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TimerApi from "@lib/warcraft3-api/timer";
import { debug } from "./debug";
import { disableBuiltInAi } from "./core/disable-built-in-ai";
import { perceiveWorld } from "./perception/perceive-world";
import { createTowerRushContext } from "./strategies/tower-rush/tower-rush-context";
import { updateTowerRush } from "./strategies/tower-rush/tower-rush";

declare const warlord_bot_player: W3PlayerApi.player;
declare function guard(this: void, callback: (this: void) => void): (this: void) => void;

const UPDATE_INTERVAL_SECONDS = 1;

main(warlord_bot_player);

function main(bot: W3PlayerApi.player) {
  debug(`Bot player id: ${W3PlayerApi.GetPlayerId(bot)}`);

  // These are AI-script natives that may not exist in a map script; guarding
  // reports such a failure without preventing the bot from starting.
  guard(() => disableBuiltInAi(bot))();

  const towerRush = createTowerRushContext();

  const update = () => updateTowerRush(perceiveWorld(bot), towerRush);

  update();

  W3TimerApi.TimerStart(
    W3TimerApi.CreateTimer(),
    UPDATE_INTERVAL_SECONDS,
    true,
    guard(update),
  );
}
