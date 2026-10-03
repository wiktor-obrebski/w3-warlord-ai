/**
 * Warcraft APIs needed only by installation and test code in `src/privileged/`.
 * Normal bot gameplay must not use this module.
 */
declare module "@lib/warcraft3-api/privileged" {
  /**
   * @ai-generated State of a player slot, such as empty, playing, or left.
   *
   * @patch 1.00
   */
  export interface playerslotstate extends handle {
    __playerslotstate: never;
  }

  /**
   * @ai-generated A player color, such as red or blue.
   *
   * @patch 1.00
   */
  export interface playercolor extends handle {
    __playercolor: never;
  }

  /**
   * @ai-generated Slot state of an unoccupied player slot.
   *
   * @patch 1.00
   */
  export const PLAYER_SLOT_STATE_EMPTY: playerslotstate;

  /**
   * @ai-generated Slot state of a player who has left the game.
   *
   * @patch 1.00
   */
  export const PLAYER_SLOT_STATE_LEFT: playerslotstate;

  /**
   * @ai-generated Player state selecting the player's hero tokens, used by melee games to limit free heroes.
   *
   * @patch 1.00
   */
  export const PLAYER_STATE_RESOURCE_HERO_TOKENS: playerstate;

  /**
   * Returns: nothing
   *
   * Changes ownership of a unit.
   *
   * @param whichUnit (unit) Unit to modify.
   * @param whichPlayer (player) The unit's new owner.
   * @param changeColor (boolean) True to update unit's tinting color to new owner's color, false to leave old color.
   *
   * @note New color is only applied if the unit really changed ownership from one player to another.
   * @note Reforged: The HP bar will always have the color of its owner player, regardless of `changeColor`.
   * @note See: `GetOwningPlayer`, `Player`, `SetUnitColor`, `BlzSetSpecialEffectColorByPlayer`.
   * @patch 1.00
   */
  export function SetUnitOwner(whichUnit: unit, whichPlayer: player, changeColor: boolean): void;

  /**
   * Returns: nothing
   *
   * @ai-generated Sets the value of the given player state, such as current gold or lumber.
   *
   * @patch 1.00
   */
  export function SetPlayerState(whichPlayer: player, whichPlayerState: playerstate, value: number): void;

  /**
   * Returns: nothing
   *
   * @ai-generated Sets the player's displayed name.
   *
   * @patch 1.07
   */
  export function SetPlayerName(whichPlayer: player, name: string): void;

  /**
   * Returns: nothing
   *
   * @ai-generated Assigns the start location with the given index to the player.
   *
   * @note This function shall only be used within the scope of function `config`
   *   in war3map.j, it is executed by the game when you load the lobby/selected
   *   the map for preview.
   * @patch 1.00
   */
  export function SetPlayerStartLocation(whichPlayer: player, startLocIndex: number): void;

  /**
   * Returns: playercolor
   *
   * @ai-generated Returns the player's color.
   *
   * @patch 1.00
   */
  export function GetPlayerColor(whichPlayer: player): playercolor;

  /**
   * Returns: nothing
   *
   * @ai-generated Sets the player's color.
   *
   * @note This function is called by the game within the scope of `config`
   *   to set each player's color.
   * @patch 1.00
   */
  export function SetPlayerColor(whichPlayer: player, color: playercolor): void;
}
