declare module "@lib/warcraft3-api/location" {
  /**
   * @ai-generated A point on the map defined by X and Y coordinates.
   *
   * @patch 1.00
   */
  export interface location extends agent {
    __location: never;
  }

  /**
   * Returns: location
   *
   * @ai-generated Creates a new location at the given start location. Remove it with `RemoveLocation` when no longer needed.
   *
   * @patch 1.00
   */
  export function GetStartLocationLoc(whichStartLocation: number): location;

  /**
   * Returns: real
   *
   * @ai-generated Returns the X map coordinate of the given start location.
   *
   * @patch 1.00
   */
  export function GetStartLocationX(whichStartLocation: number): number;

  /**
   * Returns: real
   *
   * @ai-generated Returns the Y map coordinate of the given start location.
   *
   * @patch 1.00
   */
  export function GetStartLocationY(whichStartLocation: number): number;

  /**
   * Returns: real
   *
   * @ai-generated Returns the X map coordinate of the location.
   *
   * @patch 1.00
   */
  export function GetLocationX(whichLocation: location): number;

  /**
   * Returns: real
   *
   * @ai-generated Returns the Y map coordinate of the location.
   *
   * @patch 1.00
   */
  export function GetLocationY(whichLocation: location): number;

  /**
   * Returns: real
   *
   * Returns the current surface elevation at the (x,y) location.
   *
   * This includes the terrain (hills or water) and walkable destructables.
   *
   * @note Destructables spawn in the dead state/animation by default.
   *
   *   If the "dead" animation has a different height than its "alive" animation, then the following code
   *   will return the Z position as if the destructable was dead:
   *
   *   ```{.lua}
   *   x, y = 0, -1024
   *   platform = CreateDestructable(FourCC("DTrx"), x, y, 180, 1, 0)
   *   loc = Location(x, y)
   *   print("IsDead, HP: ", IsDestructableDeadBJ(platform), GetDestructableLife(platform))
   *
   *   print(GetLocationX(loc), GetLocationY(loc), GetLocationZ(loc)) -- "dead" state height
   *
   *   --KillDestructable(platform)
   *   --RemoveDestructable(platform); RemoveLocation(loc)
   *   ```
   *
   *   And if you rerun the last print line in the next tick like after `TriggerSleepAction` then
   *   you will see its expected lower height because it's now in the "alive" animation.
   *
   *   `SetDestructableAnimation(platform, "stand")` does not work as a workaround.
   *
   *   HD Model: "Stand 1", "Death 1" & SD Model: "Stand", "Death".
   * @note Reasons for returning different values between players might be terrain-deformations
   *   caused by spells/abilities and different graphic settings.
   *   Other reasons could be the rendering state of destructables and visibility differences.
   * @note Returns 0 if `whichLocation` is null.
   * @note See: `BlzGetUnitZ`.
   * @async
   * @patch 1.18a
   */
  export function GetLocationZ(whichLocation: location): number;

  /**
   * Returns: nothing
   *
   * @ai-generated Destroys the location.
   *
   * @patch 1.00
   */
  export function RemoveLocation(whichLocation: location): void;

}
