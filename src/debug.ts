import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3UiApi from '@lib/warcraft3-api/ui';

export { debug };

function debug({ message }: { message: string }) {
  const humanPlayer = W3PlayerApi.Player(0);

  W3UiApi.DisplayTextToPlayer(humanPlayer, 0, 0, `[Warlord] ${message}`);
}
