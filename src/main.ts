import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3UiApi from "@lib/warcraft3-api/ui";

declare const warlord_bot_player: W3PlayerApi.player;

main(warlord_bot_player);

function main(bot: W3PlayerApi.player) {
  const humanPlayer = W3PlayerApi.Player(0);
  if (humanPlayer) {
    W3UiApi.DisplayTextToPlayer(humanPlayer, 0, 0, "Welcome! You face the W3 Warlord AI!");
    throw new Error("Source-map test");
  }
}
