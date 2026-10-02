declare module "@lib/warcraft3-api/group" {
  /**
   * @ai-generated A collection of unit references.
   *
   * @patch 1.00
   */
  export interface group extends agent { __group: never; }

  /**
   * A single unit reference.
   *
   * @patch 1.00
   */
  export interface unit extends widget { __unit: never; }

  /**
   * Returns: group
   *
   * @ai-generated Creates a new empty unit group.
   *
   * @patch 1.00
   */
  export function CreateGroup(): group;

  /**
   * Returns: nothing
   *
   * Clears a group and then adds units of matching player to it.
   *
   * Does nothing if `whichGroup` or `whichPlayer` is null.
   *
   * @param whichGroup (group) The group to be modified.
   * @param whichPlayer (player) The player whose units to consider for adding units.
   * @param filter (boolexpr) A filter function that is run for each considered unit.
   *
   * @note In contrast to spatial GroupEnum-functions, this function enumerates units with locust.
   * @note Within the filter function, the considered unit can be accessed with `GetFilterUnit`.
   * @note The filter function must return true (a truthy value in Lua) in order to add the unit to the group.
   * @note If the filter function is `null` (`nil` in Lua), all considered units will be added to the group.
   * @note The units are added consecutively to the group between filter runs, not in bulk after all filter runs were processed.
   * @note In terms of running the filter function, units are processed in reverse order in which they were created on the map.
   * @patch 1.00
   */
  export function GroupEnumUnitsOfPlayer(whichGroup: group, whichPlayer: player, filter: boolexpr | null): void;

  /**
   * Returns: nothing
   *
   * Clears a group and then adds units within given radius of map coordinates to it.
   *
   * Does nothing if `whichGroup` is null.
   *
   * @param whichGroup (group) The group to be modified.
   * @param x (real) X map coordinate.
   * @param y (real) Y map coordinate.
   * @param radius (real) Radius in map units.
   * @param filter (boolexpr) A filter function that is run for each considered unit.
   *
   * @note Does not consider locust units. Locust units cannot be spatially enumerated.
   * @note Within the filter function, the considered unit can be accessed with `GetFilterUnit`.
   * @note The filter function must return true (a truthy value in Lua) in order to add the unit to the group.
   * @note If the filter function is `null` (`nil` in Lua), all considered units will be added to the group.
   * @note The units are added consecutively to the group between filter runs, not in bulk after all filter runs were processed.
   * @note In terms of running the filter function, units are processed in a certain order. The playing field is divided into
   *   sectors of 256x256, i.e., {[minX=0, minY=0, maxX=256, maxY=256], [minX=256, minY=0, maxX=512, maxY=256],
   *   [minX=0, minY=256, maxX=256, maxY=512], [minX=256, minY=256, maxX=512, maxY=512], ...}. The game keeps track what units are
   *   in what sector and the order in which they were added. The filters run from bottom to top sectors as an outer loop and
   *   from left to right sectors as an inner loop. Within each sector, the units are processed in reverse order in which they
   *   were added to the sector.
   * @note The origin of the unit must be within the area of the circle to be considered. The collision size of the unit
   *   does not matter.
   * @note Hidden units are not enumerated with this function.
   * @note Observed in a Lua map script: at a Night Elf melee start the main gold mine is found only as the Entangled Gold Mine
   *   (`egol`), not as the original `ngol`, which is hidden. Undead Haunted Gold Mines (`ugol`) are assumed to behave the same.
   * @note See: `GroupEnumUnitsInRect`, `GroupEnumUnitsInRangeOfLoc`.
   * @patch 1.00
   */
  export function GroupEnumUnitsInRange(whichGroup: group, x: number, y: number, radius: number, filter?: boolexpr): void;

  /**
   * Returns: unit
   *
   * Returns the unit at the first position in group or null if that unit no longer exists.
   *
   * Equivalent to: `BlzGroupUnitAt(varGroup, 0)`.
   *
   * @bug If the first unit of this group was removed from the game (RemoveUnit or decayed) then null be returned, regardless if there're valid units in group at further indeces. To iterate over all existing units of a group, use `ForGroup`/`ForGroupBJ`.
   *   You cannot remove such null "holes" from a group without destroying or clearing it (`DestroyGroup`/`GroupClear`).
   *   If you use FirstOfGroup in iterations with removal, units in the group will eventually leak.
   * @note See [GroupUtils Library](https://web.archive.org/web/20200918161954/http://wc3c.net/showthread.php?t=104464) for vJass.
   * @patch 1.00
   */
  export function FirstOfGroup(whichGroup: group): unit | null;

  /**
   * Returns: boolean
   *
   * Removes unit from group, returns true on success; returns false on failure (no operation).
   *
   * If unit is null, does nothing and returns false regardless if there're null values at any index in the group (does not remove destroyed units which are still in group).
   *
   * @patch 1.00
   */
  export function GroupRemoveUnit(whichGroup: group, whichUnit: unit): boolean;

  /**
   * Returns: nothing
   *
   * Destroys the group.
   *
   * Accessing a destroyed group shows no units, a size of 0 and cannot be modified in any way.
   *
   * @patch 1.07
   */
  export function DestroyGroup(whichGroup: group): void;
}
