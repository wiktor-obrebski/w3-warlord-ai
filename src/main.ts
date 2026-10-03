import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3TimerApi from "@lib/warcraft3-api/timer";
import { debug } from "./debug";
import { disableBuiltInAi } from "./core/disable-built-in-ai";
import { perceiveWorld } from "./perception/perceive-world";
import { installBotPlayer } from "./privileged/install-bot-player";
import { createTowerRushContext } from "./strategies/tower-rush/tower-rush-context";
import { updateTowerRush } from "./strategies/tower-rush/tower-rush";

declare const warlord_computer_player: W3PlayerApi.player;
declare function guard(this: void, callback: (this: void) => void): (this: void) => void;

const UPDATE_INTERVAL_SECONDS = 1;

const bot = installBotPlayer(warlord_computer_player);
runAfterMapInitialization(() => main(bot));

function main(bot: W3PlayerApi.player) {
  debug(`Bot player id: ${W3PlayerApi.GetPlayerId(bot)}`);

  disableBuiltInAi(bot);

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

function runAfterMapInitialization(callback: (this: void) => void) {
  const timer = W3TimerApi.CreateTimer();

  W3TimerApi.TimerStart(timer, 0, false, guard(() => {
    W3TimerApi.DestroyTimer(timer);
    callback();
  }));
}
