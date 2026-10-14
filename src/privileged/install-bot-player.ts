import * as W3GroupApi from '@lib/warcraft3-api/group';
import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3PrivilegedApi from '@lib/warcraft3-api/privileged';

export { installBotPlayer };

interface InstallBotPlayerArgs {
  computerPlayer: W3PlayerApi.player;
}

/**
 * Moves the computer player chosen in the lobby into an empty slot and
 * returns that slot's player for the bot to control.
 *
 * Must run before `MeleeInitVictoryDefeat`, which only tracks players whose
 * slot state is playing at that moment.
 */
function installBotPlayer({
  computerPlayer,
}: InstallBotPlayerArgs): W3PlayerApi.player {
  const installations = setupBotInstallations();
  const botPlayer = findEmptyPlayerSlot();

  if (!botPlayer) {
    throw new Error('No empty player slot available for Warlord AI.');
  }

  transferPlayer({ fromPlayer: computerPlayer, toPlayer: botPlayer });
  W3PrivilegedApi.SetPlayerName(botPlayer, 'Warlord AI');

  installations.push({ computerPlayer, botPlayer });

  return botPlayer;
}

interface BotInstallation {
  computerPlayer: W3PlayerApi.player;
  botPlayer: W3PlayerApi.player;
}

/**
 * Globals of the map script itself. Every bot runs in its own bundle instance,
 * so state shared between installed bots has to live here.
 */
interface MapGlobals {
  GetPlayerSlotState: (
    this: void,
    whichPlayer: W3PlayerApi.player
  ) => W3PlayerApi.playerslotstate;
  GetPlayerRace: (
    this: void,
    whichPlayer: W3PlayerApi.player
  ) => W3PlayerApi.race;
  WarlordBotInstallations?: BotInstallation[];
}

declare const map_globals: MapGlobals;

/**
 * The first installation replaces `GetPlayerSlotState` so the map sees every
 * bot slot as playing and every abandoned computer player as gone. Later
 * installations only register themselves, which also keeps them from picking
 * a slot already taken by an earlier bot.
 *
 * It also replaces `GetPlayerRace`: a player's race cannot be changed after
 * the lobby, so a bot slot keeps the default race of an empty slot, while its
 * starting units were created for the computer player's race. Every bot slot
 * therefore reports the race of the computer player it replaced.
 */
function setupBotInstallations(): BotInstallation[] {
  const existing = map_globals.WarlordBotInstallations;

  if (existing) {
    return existing;
  }

  const installations: BotInstallation[] = [];
  const realGetPlayerSlotState = map_globals.GetPlayerSlotState;
  const realGetPlayerRace = map_globals.GetPlayerRace;

  map_globals.WarlordBotInstallations = installations;
  map_globals.GetPlayerRace = (whichPlayer) => {
    for (const installation of installations) {
      if (installation.botPlayer === whichPlayer) {
        return realGetPlayerRace(installation.computerPlayer);
      }
    }

    return realGetPlayerRace(whichPlayer);
  };
  map_globals.GetPlayerSlotState = (whichPlayer) => {
    for (const installation of installations) {
      if (installation.botPlayer === whichPlayer) {
        return W3PlayerApi.PLAYER_SLOT_STATE_PLAYING;
      }

      if (installation.computerPlayer === whichPlayer) {
        return W3PrivilegedApi.PLAYER_SLOT_STATE_LEFT;
      }
    }

    return realGetPlayerSlotState(whichPlayer);
  };

  return installations;
}

function findEmptyPlayerSlot(): W3PlayerApi.player | undefined {
  for (let id = 0; id < W3PlayerApi.bj_MAX_PLAYERS; id++) {
    const candidate = W3PlayerApi.Player(id);

    if (
      candidate &&
      W3PlayerApi.GetPlayerSlotState(candidate) ===
        W3PrivilegedApi.PLAYER_SLOT_STATE_EMPTY
    ) {
      return candidate;
    }
  }

  return undefined;
}

interface TransferPlayerArgs {
  fromPlayer: W3PlayerApi.player;
  toPlayer: W3PlayerApi.player;
}

function transferPlayer({ fromPlayer, toPlayer }: TransferPlayerArgs) {
  const units = W3GroupApi.CreateGroup();
  W3GroupApi.GroupEnumUnitsOfPlayer(units, fromPlayer, null);

  while (true) {
    const unit = W3GroupApi.FirstOfGroup(units);

    if (!unit) {
      break;
    }

    W3GroupApi.GroupRemoveUnit(units, unit);
    W3PrivilegedApi.SetUnitOwner(unit, toPlayer, true);
  }

  W3GroupApi.DestroyGroup(units);

  W3PrivilegedApi.SetPlayerStartLocation(
    toPlayer,
    W3PlayerApi.GetPlayerStartLocation(fromPlayer)
  );
  W3PrivilegedApi.SetPlayerColor(
    toPlayer,
    W3PrivilegedApi.GetPlayerColor(fromPlayer)
  );

  for (const resource of [
    W3PlayerApi.PLAYER_STATE_RESOURCE_GOLD,
    W3PlayerApi.PLAYER_STATE_RESOURCE_LUMBER,
    W3PrivilegedApi.PLAYER_STATE_RESOURCE_HERO_TOKENS,
  ]) {
    W3PrivilegedApi.SetPlayerState(
      toPlayer,
      resource,
      W3PlayerApi.GetPlayerState(fromPlayer, resource)
    );
  }
}
