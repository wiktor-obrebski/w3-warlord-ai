declare module "@lib/warcraft3-api/player" {
  /**
   * @patch 1.00
   */
  export interface player extends agent {
    __player: never;
  }

  /**
   * Stores the maximum number of playable player slots regardless of map options.
   *
   * @note See: `GetBJMaxPlayers`, `GetBJMaxPlayerSlots`
   * @patch 1.00
   */
  export const bj_MAX_PLAYERS: number;
  /**
   * @patch 1.00
   */
  export const PLAYER_SLOT_STATE_PLAYING: playerslotstate;
  /**
   * @ai-generated Player state selecting the player's current gold.
   *
   * @patch 1.00
   */
  export const PLAYER_STATE_RESOURCE_GOLD: playerstate;

  /**
   * Returns: player
   *
   * Returns the instance of player based on ID number.
   *
   * This function always returns the same instance, does not create new objects.
   * If used with invalid values (below 0 or above `GetBJMaxPlayerSlots`), returns null in Reforged, crashed on Classic.
   *
   * @note
   *   Common.j: IDs start from 0, e.g. Player(0) is red, 1 is blue etc. -> `GetPlayerId`
   *   Blizzard.j (WorldEdit): IDs start with 1 -> `GetConvertedPlayerId`.
   * @note See: `GetPlayerId`, `GetBJMaxPlayers`, `GetBJMaxPlayerSlots`, `GetPlayerNeutralPassive`, `GetPlayerNeutralAggressive`.
   * @bug In old versions (which?) crashes the game if used with wrong values, that is values greather than 15
   *   or values lower than 0.
   * @pure
   * @patch 1.00
   */
  export function Player(number: number): player | undefined;
  /**
   * Returns: integer
   *
   * Returns player ID of player (which starts with zero; e.g. player red is 0).
   *
   * @param whichPlayer (player) Target player.
   *
   * @note For one-based WorldEdit-type IDs see: `GetConvertedPlayerId`. Also: `Player`.
   * @patch 1.00
   */
  export function GetPlayerId(whichPlayer: player): number;
  /**
   * Returns: integer
   *
   * Returns an integer representation of a player's start location. If the player
   * has a start location on the map (regardless of whether that player slot is filled),
   * it will return the player's ID (e.g. Player 1 (red) will return 0, Player 2 (blue)
   * will return 1, and so forth). If the player does not have a start location
   * on the map, it will return -1.
   *
   * @param whichPlayer (player) The player of which to return the starting location.
   *
   * @patch 1.00
   */
  export function GetPlayerStartLocation(whichPlayer: player): number;
  /**
   * Returns: playerslotstate
   *
   * @patch 1.00
   */
  export function GetPlayerSlotState(whichPlayer: player): playerslotstate;
  /**
   * Returns: boolean
   *
   * @patch 1.00
   */
  export function IsPlayerEnemy(whichPlayer: player, otherPlayer: player): boolean;

  /**
   * Returns: integer
   *
   * @ai-generated Returns the value of the given player state, such as current gold or lumber.
   *
   * @patch 1.00
   */
  export function GetPlayerState(whichPlayer: player, whichPlayerState: playerstate): number;
}
