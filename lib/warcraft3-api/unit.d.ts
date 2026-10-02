declare module "@lib/warcraft3-api/unit" {
  /**
   * @patch 1.00
   */
  export const UNIT_TYPE_PEON: unittype;
  /**
   * @ai-generated Unit state selecting the unit's current hit points.
   *
   * @patch 1.00
   */
  export const UNIT_STATE_LIFE: unitstate;

  /**
   * @patch 1.00
   */
  export interface unit extends widget { __unit: never; }

  /**
   * Returns: boolean
   *
   * @note If the order is to build a structure and the unit can build that structure in principle but the player lacks the resources for it, then the unit
   *   will be pinged on the minimap in yellow for its owning player.
   * @bug If the order is to build a structure and the unit can build that structure in principle (and the spot is not blocked, either),
   *   this function will still return `true` even if the player lacks the resources for it.
   * @patch 1.00
   */
  export function IssueBuildOrderById(whichPeon: unit, unitId: number, x: number, y: number): boolean;
  /**
   * Returns: boolean
   *
   * @patch 1.00
   */
  export function IssueImmediateOrder(whichUnit: unit, order: string): boolean;
  /**
   * Returns: boolean
   *
   * Returns:
   *
   * - true if basic requirements were met and the order was issued
   * - false if order was not issued
   *
   * @note **Example (Lua, 2.0.4):** Order barracks to train a footman.
   *
   *   ```{.lua}
   *   myPlayer = Player(0)
   *   barracks = CreateUnit(myPlayer, FourCC("hbar"), 0, -768, 270.0)
   *   farm1 = CreateUnit(myPlayer, FourCC("hhou"), 256, -768, 270.0)
   *   farm2 = CreateUnit(myPlayer, FourCC("hhou"), 384, -768, 270.0)
   *   farm3 = CreateUnit(myPlayer, FourCC("hhou"), 512, -768, 270.0)
   *
   *   SetPlayerState(myPlayer, PLAYER_STATE_RESOURCE_GOLD, 10000)
   *   SetPlayerState(myPlayer, PLAYER_STATE_RESOURCE_LUMBER, 10000)
   *
   *   isIssued = IssueImmediateOrderById(barracks, FourCC("hfoo"))
   *   ```
   * @patch 1.00
   */
  export function IssueImmediateOrderById(whichUnit: unit, order: number): boolean;
  /**
   * Returns: boolean
   *
   * @note If the order is to build a structure and the unit can build that structure in principle but the player lacks the resources for it, then the unit
   *   will be pinged on the minimap in yellow for its owning player.
   * @bug If the order is to build a structure, this function will return `false` even if the unit accepts the order.
   * @patch 1.00
   */
  export function IssuePointOrder(whichUnit: unit, order: string, x: number, y: number): boolean;
  /**
   * Returns: boolean
   *
   * @patch 1.00
   */
  export function IssueTargetOrder(whichUnit: unit, order: string, targetWidget: widget): boolean;

  /**
   * Returns: integer
   *
   * @patch 1.00
   */
  export function GetUnitTypeId(whichUnit: unit): number;
  /**
   * Returns: boolean
   *
   * @note This native returns a boolean, which when typecasted to integer might
   *   be greater than 1. It's probably implemented via a bitset.
   * @note In past patches this native bugged when used in `conditionfunc`s.
   *   The fix back then was to compare with true (`==true`).
   *   I cannot reproduce the faulty behaviour in patch 1.27 so this is only a note.
   * @patch 1.00
   */
  export function IsUnitType(whichUnit: unit, whichUnitType: unittype): boolean;
  /**
   * Returns: real
   *
   * Returns X map coordinate of whichUnit (alive or dead). Returns 0.0 if unit was removed or is null.
   *
   * @bug If the unit is loaded into a zeppelin this will not return the position
   *   of the zeppelin but the last position of the unit before it was loaded into
   *   the zeppelin.
   * @note Since unit extends from `widget`, you can use widget-related functions too.
   *   See: `GetUnitY`, `BlzGetUnitZ`, `GetWidgetX`, `GetWidgetY`.
   * @patch 1.00
   */
  export function GetUnitX(whichUnit: unit): number;
  /**
   * Returns: real
   *
   * Returns Y map coordinate of whichUnit (alive or dead). Returns 0.0 if unit was removed or is null.
   *
   * @bug If the unit is loaded into a zeppelin this will not return the position
   *   of the zeppelin but the last position of the unit before it was loaded into
   *   the zeppelin.
   * @note Since unit extends from `widget`, you can use widget-related functions too.
   *   See: `GetUnitX`, `BlzGetUnitZ`, GetWidgetX`, `GetWidgetY`.
   * @patch 1.00
   */
  export function GetUnitY(whichUnit: unit): number;

  /**
   * Returns: integer
   *
   * @ai-generated Returns the order id of the unit's current order, or 0 if the unit has no order.
   *
   * @patch 1.13
   */
  export function GetUnitCurrentOrder(whichUnit: unit): number;
  /**
   * Returns: real
   *
   * Returns unit's current unit state as an absolute value.
   *
   * **Example:** Retrieve a unit's current/max HP and mana:
   *
   *     call GetUnitState(myUnit, UNIT_STATE_MAX_MANA) // returns 285.0
   *
   * @note See: `SetUnitState`.
   * @patch 1.00
   */
  export function GetUnitState(whichUnit: unit, whichUnitState: unitstate): number;
}
