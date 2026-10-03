/**
 * Warcraft APIs needed only by installation, debug-mode and test code in `src/privileged/`.
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

  /**
   * @ai-generated An axis-aligned rectangle in world coordinates.
   *
   * @patch 1.00
   */
  export interface rect extends agent {
    __rect: never;
  }

  /**
   * Represents different fog of war types.
   *
   * - `FOG_OF_WAR_MASKED` (1): Black mask, an unexplored map area.
   *     - If "Masked areas are partially visible" is enabled in
   *       Map Properties, unexplored areas are shown in dark grey.
   *       You can see the terrain, but no units.
   *     - If disabled, unexplored areas are black and not visible.
   * - `FOG_OF_WAR_FOGGED` (2): Haze, a previously explored
   *   map area that is currently not visible.
   *     - You can see the terrain, but no units.
   * - `FOG_OF_WAR_VISIBLE` (4): A fully visible map area.
   * - Other (non-existent) fog types do nothing.
   *
   * @patch 1.00
   */
  export interface fogstate extends handle {
    __fogstate: never;
  }

  /**
   * @ai-generated Overrides the fog of war in an area for a specific player while enabled.
   *
   * @patch 1.00
   */
  export interface fogmodifier extends agent {
    __fogmodifier: never;
  }

  /**
   * @ai-generated A scoreboard-like table displayed in the top-right corner of the screen.
   *
   * @patch 1.07
   */
  export interface multiboard extends agent {
    __multiboard: never;
  }

  /**
   * @ai-generated A handle to a single multiboard cell, acquired with `MultiboardGetItem`.
   *
   * @patch 1.07
   */
  export interface multiboarditem extends agent {
    __multiboarditem: never;
  }

  /**
   * See `fogstate` for an explanation.
   *
   * @patch 1.00
   */
  export const FOG_OF_WAR_VISIBLE: fogstate;

  /**
   * Returns: rect
   *
   * Returns a new instance of rectangle that spans the entire map, including
   * unplayable borders, in world coordinates.
   *
   * Since this creates a new rectangle on each call, the rectangle object must be
   * destroyed manually by calling `RemoveRect`.
   *
   * @note See: `Rect`, `RemoveRect`.
   * @patch 1.00
   */
  export function GetWorldBounds(): rect;

  /**
   * Returns: fogmodifier
   *
   * Creates an object that overrides the fog in a rect for a specific player.
   *
   * A fog modifier is disabled by default, use `FogModifierStart` to enable.
   *
   * This creates a new object with a handle and must be removed to avoid leaks: `DestroyFogModifier`.
   *
   * @param whichState (fogstate) Determines what type of fog the area is being modified to. See `fogstate` for type explanation.
   * @param where (rect) The rect where the fog is.
   * @param useSharedVision (boolean) Apply modifier to target's allied players with shared vision?
   * @param afterUnits (boolean) Will determine whether or not units in that area will be masked by the fog. If it is set to true and the fogstate is masked, it will hide all the units in the fog modifier's radius and mask the area. If set to false, it will only mask the areas that are not visible to the units.
   *
   * @bug (v1.32.10) Just by creating a modifier of type `FOG_OF_WAR_FOGGED` or
   *   `FOG_OF_WAR_VISIBLE`, this will modify the player's global fog state before it is
   *   enabled. "VISIBLE" will instantly become "FOGGED" and "FOGGED" will cause unexplored
   *   areas to become explored. You can workaround this by using e.g. `SetFogStateRect`
   *   after fog modifier creation.
   * @patch 1.00
   */
  export function CreateFogModifierRect(
    forWhichPlayer: player,
    whichState: fogstate,
    where: rect,
    useSharedVision: boolean,
    afterUnits: boolean,
  ): fogmodifier;

  /**
   * Returns: nothing
   *
   * Enable the effect of the modifier. While enabled, it will override the player's
   * regular fog state.
   *
   * @patch 1.00
   */
  export function FogModifierStart(whichFogModifier: fogmodifier): void;

  /**
   * Returns: multiboard
   *
   * Creates a new multiboard and returns its handle.
   *
   * The new multiboard by default:
   *
   * - does not have a title
   * - row and column count are 0
   * - is not displayed
   * - is not minimized
   *
   * To display a multiboard after creation, you must use `MultiboardDisplay`.
   *
   * @note Multiboards must be destroyed to prevent leaks: `DestroyMultiboard`.
   * @note Only one multiboard can be visible at a time.
   *   However there's a workaround using [Frame API](https://www.hiveworkshop.com/threads/ui-showing-3-multiboards.316610/).
   * @note There's a bug that causes big multiboards to
   *   [freeze/crash the game on 1.33](https://www.hiveworkshop.com/threads/maximizing-the-multiboard-leads-to-freezing-game-with-the-latest-reforged-patch.341873/#post-3550996).
   * @bug Do not use this in a global initialisation as it crashes the game there.
   * @patch 1.07
   */
  export function CreateMultiboard(): multiboard;

  /**
   * Returns: nothing
   *
   * Sets a multiboard's name.
   *
   * The new text appears instantly.
   * The multiboard will expand as wide as necessary to display the title.
   *
   * @param lb (multiboard) Target multiboard.
   * @param label (string) New name.
   *
   * @note See: `MultiboardGetTitleText`
   * @patch 1.07
   */
  export function MultiboardSetTitleText(lb: multiboard, label: string): void;

  /**
   * Returns: nothing
   *
   * Shows or hides the multiboard.
   *
   * Can be used to force a multiboard update.
   *
   * @param lb (multiboard) Target multiboard
   * @param show (boolean) `true` to show, `false` to hide.
   *
   * @note Multiboards can not be shown at map-init. Use a wait or a zero-timer to
   *   display as soon as possible.
   * @note See: `IsMultiboardDisplayed`.
   * @bug `MultiboardDisplay(mb,false)`, where mb is an arbitrary non-null multiboard
   *   will close any open multiboard, regardless of whether it's `mb` or not.
   *   <http://www.wc3c.net/showthread.php?p=971681#post971681>
   * @patch 1.07
   */
  export function MultiboardDisplay(lb: multiboard, show: boolean): void;

  /**
   * Returns: nothing
   *
   * Sets the number of content rows (lines, horizontal) for the multiboard.
   *
   * @param lb (multiboard) Target multiboard.
   *
   * @bug It is only safe to change the row count by one. Use multiple calls for bigger values.
   *   <http://www.hiveworkshop.com/forums/l-715/m-250775/> (has test map)
   *   <http://www.hiveworkshop.com/forums/t-269/w-234897/> (has only code)
   * @note See: `MultiboardGetRowCount`.
   * @patch 1.07
   */
  export function MultiboardSetRowCount(lb: multiboard, count: number): void;

  /**
   * Returns: nothing
   *
   * Sets the number of content columns (vertical) for the multiboard.
   *
   * @param lb (multiboard) Target multiboard.
   *
   * @note See: `MultiboardGetColumnCount`.
   * @patch 1.07
   */
  export function MultiboardSetColumnCount(lb: multiboard, count: number): void;

  /**
   * Returns: nothing
   *
   * Sets rendering properties for all cells.
   *
   * @param lb (multiboard) Target multiboard.
   *
   * @note See: `MultiboardSetItemStyle` for a detailed description.
   * @patch 1.07
   */
  export function MultiboardSetItemsStyle(lb: multiboard, showValues: boolean, showIcons: boolean): void;

  /**
   * Returns: nothing
   *
   * Sets the new width for all cells.
   *
   * @param lb (multiboard) Target multiboard.
   * @param width (real) New cell width expressed as screen width. `1.0` = 100% of screen width,
   *   `0.05` = 5% of screen width.
   *
   * @note See: `MultiboardSetItemWidth` for a detailed description.
   * @patch 1.07
   */
  export function MultiboardSetItemsWidth(lb: multiboard, width: number): void;

  /**
   * Returns: multiboarditem
   *
   * Acquires and returns a new handle for the multiboard cell.
   *
   * @param lb (multiboard) Target multiboard.
   * @param row (integer) In which row is the target cell (Y-coord, up-down). Starts from 0.
   * @param column (integer) in which column is the target cell (X-coord, left-right). Starts from 0.
   *
   * @note Because a new handle is created each time, the handle must be
   *   freed with `MultiboardReleaseItem`. The handle is different even if you
   *   retrieve the same cell of the multiboard (v1.32.10, Lua).
   * @note The parameter order of `row` and `column` is (y,x) if you think of coordinates.
   * @patch 1.07
   */
  export function MultiboardGetItem(lb: multiboard, row: number, column: number): multiboarditem;

  /**
   * Returns: nothing
   *
   * Sets the cell's text. It is empty by default.
   *
   * @param mbi (multiboarditem) Target cell handle.
   * @param val (string) New text.
   *
   * @note You must make sure the new text will fit in current width by setting
   *   `MultiboardSetItemWidth` appropriately. If the width is too small, the text will be
   *   cut off.
   * @note See: `MultiboardSetItemsValue`.
   * @patch 1.07
   */
  export function MultiboardSetItemValue(mbi: multiboarditem, val: string): void;

  /**
   * Returns: nothing
   *
   * Destroys the handle previously created with `MultiboardGetItem`.
   *
   * It must be used to prevent leaks. Releasing the handle does not destroy or modify the
   * item.
   *
   * @patch 1.07
   */
  export function MultiboardReleaseItem(mbi: multiboarditem): void;
}
