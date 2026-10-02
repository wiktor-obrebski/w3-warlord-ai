declare module "@lib/warcraft3-api/unit" {
  /**
   * @ai-generated Unit classification for workers, used with `IsUnitType`.
   *
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
   * A single unit reference.
   *
   * @patch 1.00
   */
  export interface unit extends widget { __unit: never; }

  /**
   * Returns: boolean
   *
   * @ai-generated Orders the worker to build the structure with the given type id at the given point. Returns true if the order was issued.
   *
   * @note If the order is to build a structure and the unit can build that structure in principle but the player lacks the resources for it, then the unit
   *   will be pinged on the minimap in yellow for its owning player.
   * @bug If the order is to build a structure and the unit can build that structure in principle (and the spot is not blocked, either),
   *   this function will still return `true` even if the player lacks the resources for it.
   * @note Observed in a Lua map script: returns `false` when the target spot is blocked or unbuildable, so trying candidate points
   *   until one is accepted works as a placement search. A Peasant reverted from Militia accepts build orders normally.
   * @patch 1.00
   */
  export function IssueBuildOrderById(whichPeon: unit, unitId: number, x: number, y: number): boolean;

  /**
   * Returns: boolean
   *
   * @ai-generated Issues a targetless order by its order string. Returns true if the order was issued.
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
   * @ai-generated Issues an order targeting a point by its order string. Returns true if the order was issued.
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
   * @ai-generated Issues an order targeting a widget by its order string. Returns true if the order was issued.
   *
   * @patch 1.00
   */
  export function IssueTargetOrder(whichUnit: unit, order: string, targetWidget: widget): boolean;

  /**
   * Returns: integer
   *
   * @ai-generated Returns the unit type id (rawcode) of the unit.
   *
   * @patch 1.00
   */
  export function GetUnitTypeId(whichUnit: unit): number;

  /**
   * Returns: boolean
   *
   * @ai-generated Returns true if the unit has the given classification.
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
   * Returns: integer
   *
   * Returns an internal ID for the unit order string.
   *
   * **Example (Lua):**
   *
   * ```{.lua}
   * OrderId("humanbuild") == 851995 -- this order opens the human build menu
   * ```
   *
   * @note See: `OrderId2String`, `GetIssuedOrderId`
   * @bug Do not use this in a global initialisation (map init) as it returns 0 there.
   * @bug
   *   Orders: `humainbuild` / `orcbuild` / `nightelfbuild` / `undeadbuild` are [totally broken](https://www.hiveworkshop.com/threads/build-order-causing-all-player-builders-to-open-build-menu.339196/post-3529953), don't issue them.
   * @pure
   * @patch 1.00
   */
  export function OrderId(orderIdString: string): number;

  /**
   * Returns: integer
   *
   * Returns the internal index of the given handle; returns 0 if `h` is `null`.
   *
   * Typical handles of game objects are offset by positive `0x100000`.
   *
   * For text tags, returns the text tag ID, which count from 0 to 99 (inclusive).
   *
   * **Example:** `GetHandleId(Player(0)) --> 1048584`
   *
   * @param h (handle) handle of a game object
   *
   * @note Removing a game object does not automatically invalidate an allocated handle:
   *
   *   ```{.lua}
   *   uf = CreateUnit(Player(0), FourCC("hfoo"), -30, 0, 90)
   *   print(GetHandleId(uf)) --> 1049016
   *   RemoveUnit(uf)
   *   print(GetHandleId(uf)) --> 1049016
   *   uf = nil
   *   print(GetHandleId(uf)) --> 0
   *   ```
   * @note Sometimes the handle ID may be different between clients.
   * @note The handle index returned here is only a weak and not a conclusive indicator
   *   of leaking game objects. In other words, the number may be high without an actual leak.
   * @patch 1.24a
   */
  export function GetHandleId(h: handle): number;

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
