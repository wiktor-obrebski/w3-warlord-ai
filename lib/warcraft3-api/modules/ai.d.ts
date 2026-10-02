declare module "@lib/warcraft3-api/ai" {
  /**
   * Returns: nothing
   *
   * @ai-generated Toggles whether the built-in AI sends its units to defend allied players.
   *
   * @patch 1.07
   */
  export function SetDefendPlayer(state: boolean): void;

  /**
   * Returns: nothing
   *
   * Toggle the feature of making the heroes flee when they are seriously damaged.
   *
   * @param state (boolean) True: turned on. False: turned off.
   *
   * @patch 1.00
   */
  export function SetHeroesFlee(state: boolean): void;

  /**
   * Returns: nothing
   *
   * Toggle the feature of making the units flee when they are seriously damaged.
   *
   * @param state (boolean) True: turned on. False: turned off.
   *
   * @patch 1.00
   */
  export function SetUnitsFlee(state: boolean): void;

  /**
   * Returns: nothing
   *
   * Toggle the feature of making the entire group flee when it is seriously damaged.
   *
   * @param state (boolean) True: turned on. False: turned off.
   *
   * @patch 1.00
   */
  export function SetGroupsFlee(state: boolean): void;

  /**
   * Returns: nothing
   *
   * Toggle the feature of making the heroes buy items.
   *
   * @param state (boolean) True: turned on. False: turned off.
   *
   * @patch 1.07
   */
  export function SetHeroesBuyItems(state: boolean): void;

  /**
   * Returns: nothing
   *
   * Toggle the feature of making the heroes take items.
   *
   * @param state (boolean) True: turned on. False: turned off.
   *
   * @patch 1.00
   */
  export function SetHeroesTakeItems(state: boolean): void;

  /**
   * Returns: nothing
   *
   * Toggle the feature of making peons to repair damaged structures and mechanical units.
   *
   * @param state (boolean) True: turned on. False: turned off.
   *
   * @patch 1.00
   */
  export function SetPeonsRepair(state: boolean): void;

  /**
   * Returns: nothing
   *
   * Toggle the feature of making the AI target heroes.
   *
   * Gives priority to target heroes if enabled.
   *
   * @param state (boolean) True: turned on. False: turned off.
   *
   * @patch 1.00
   */
  export function SetTargetHeroes(state: boolean): void;

  /**
   * Returns: nothing
   *
   * @ai-generated Toggles whether the built-in AI watches for and reacts to high-value targets.
   *
   * @patch 1.00
   */
  export function SetWatchMegaTargets(state: boolean): void;

  /**
   * Returns: nothing
   *
   * @ai-generated Toggles the built-in AI's automatic targeting behaviour for artillery units.
   *
   * @patch 1.00
   */
  export function SetSmartArtillery(state: boolean): void;

  /**
   * Returns: nothing
   *
   * @ai-generated Toggles whether the built-in AI varies the paths its attack groups take.
   *
   * @patch 1.07
   */
  export function SetRandomPaths(state: boolean): void;

  /**
   * Returns: nothing
   *
   * @ai-generated Toggles whether the built-in AI may change the captains that lead its attack and defense groups.
   *
   * @patch 1.00
   */
  export function SetCaptainChanges(allow: boolean): void;

  /**
   * Returns: nothing
   *
   * @ai-generated Removes all guard positions of the player's units, so the built-in AI no longer returns them to those positions.
   *
   * @patch 1.00
   */
  export function RemoveAllGuardPositions(num: player): void;
}
