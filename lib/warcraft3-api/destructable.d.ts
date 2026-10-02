declare module "@lib/warcraft3-api/destructable" {
  /**
   * @patch 1.00
   */
  export interface destructable extends widget { __destructable: never; }

  /**
   * @patch 1.00
   */
  export interface rect extends agent { __rect: never; }

  /**
   * Returns: nothing
   *
   * @ai-generated Calls `actionFunc` for each destructable inside the rectangle that passes `filter`.
   * Within `actionFunc`, the current destructable can be accessed with `GetEnumDestructable`.
   *
   * @note Includes hidden destructables. `ShowDestructable`
   * @patch 1.00
   */
  export function EnumDestructablesInRect(r: rect, filter: boolexpr | undefined, actionFunc: () => void): void;
  /**
   * Returns: destructable
   *
   * Returns handle, or null on failure.
   *
   * @patch 1.00
   */
  export function GetEnumDestructable(): destructable | null;
  /**
   * Returns: real
   *
   * Returns X map coordinate.
   *
   * @note While you can create a destructable at a height using "Z" functions, there's no way to directly get its Z height.
   * @patch 1.00
   */
  export function GetDestructableX(d: destructable): number;
  /**
   * Returns: real
   *
   * Returns Y map coordinate.
   *
   * @note While you can create a destructable at a height using "Z" functions, there's no way to directly get its Z height.
   * @patch 1.00
   */
  export function GetDestructableY(d: destructable): number;
  /**
   * Returns: real
   *
   * Returns hitpoint value. Returns 0 if dead or invalid.
   *
   * @patch 1.00
   */
  export function GetDestructableLife(d: destructable): number;
}
