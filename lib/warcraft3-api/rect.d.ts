declare module "@lib/warcraft3-api/rect" {
  /**
   * @ai-generated A rectangular area of the map.
   *
   * @patch 1.00
   */
  export interface rect extends agent { __rect: never; }

  /**
   * Returns: rect
   *
   * Returns a new rectangle as defined by two points (minX, minY) and (maxX, maxY).
   *
   * The rectangle size and coordinates are limited to valid map coordinates, see
   * `GetWorldBounds`.
   *
   * @bug You can't create your own rectangle that would match the dimensions
   *   of `GetWorldBounds`. The maxX and maxY will be smaller by `32.0` than that of
   *   the world bounds.
   * @note See: `RectFromLoc`, `RemoveRect`, `GetWorldBounds`.
   * @patch 1.00
   */
  export function Rect(minx: number, miny: number, maxx: number, maxy: number): rect;

  /**
   * Returns: nothing
   *
   * Destroys the rectangle.
   *
   * If you access the rectangle after removal, all of its values will return zero.
   *
   * @patch 1.00
   */
  export function RemoveRect(whichRect: rect): void;
}
