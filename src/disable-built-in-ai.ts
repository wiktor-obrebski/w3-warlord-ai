import * as W3AiApi from "@lib/warcraft3-api/ai";
import * as W3PlayerApi from "@lib/warcraft3-api/player";

export function disableBuiltInAi(bot: W3PlayerApi.player) {
  W3AiApi.SetDefendPlayer(false);

  W3AiApi.SetHeroesFlee(false);
  W3AiApi.SetUnitsFlee(false);
  W3AiApi.SetGroupsFlee(false);

  W3AiApi.SetHeroesBuyItems(false);
  W3AiApi.SetHeroesTakeItems(false);

  W3AiApi.SetPeonsRepair(false);

  W3AiApi.SetTargetHeroes(false);
  W3AiApi.SetWatchMegaTargets(false);
  W3AiApi.SetSmartArtillery(false);
  W3AiApi.SetRandomPaths(false);

  W3AiApi.SetCaptainChanges(false);

  W3AiApi.RemoveAllGuardPositions(bot);
}
