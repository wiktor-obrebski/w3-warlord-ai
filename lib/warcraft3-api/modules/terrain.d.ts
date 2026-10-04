declare module "@lib/warcraft3-api/terrain" {
  /**
   * @ai-generated Pathing type for ground units walking on the terrain, used with `IsTerrainPathable`.
   *
   * @patch 1.18a
   */
  export const PATHING_TYPE_WALKABILITY: pathingtype;

  /**
   * Returns: boolean
   *
   * Returns if a specific pathingtype is set at the location.
   *
   * @note Returns true if the pathingtype is *not* set, false if it *is* set.
   * @patch 1.18a
   */
  export function IsTerrainPathable(x: number, y: number, t: pathingtype): boolean;
}
