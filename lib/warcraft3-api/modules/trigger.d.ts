declare module "@lib/warcraft3-api/trigger" {
  /**
   * @patch 1.00
   */
  export interface trigger extends agent { __trigger: never; }

  /**
   * Currently useless, although triggers return an event reference when you register
   * a new trigger-event, there are no useful functions.
   * You can only destroy an event object by destroying the trigger it belongs to.
   *
   * The only functions that take event are: `SaveTriggerEventHandle` and
   * `SaveTriggerEventHandleBJ`.
   *
   * A reference to an event registration.
   *
   * @patch 1.00
   */
  export interface event extends agent { __event: never; }

  /**
   * Events of this type are similar to `unitevent` but are limited to the specified player.
   *
   * This can be useful to reduce the amount of triggered events, because the "condition" check
   * will be handled within the game rather than your code.
   *
   * @note See: `TriggerRegisterPlayerUnitEvent`,
   *   or BJ `TriggerRegisterAnyUnitEventBJ`, `TriggerRegisterPlayerUnitEventSimple` to register for this event.
   * @patch 1.00
   */
  export interface playerunitevent extends eventid { __playerunitevent: never; }

  /**
   * @bug wrong type, should be `extends agent` instead.
   * @patch 1.00
   */
  export interface triggeraction extends handle { __triggeraction: never; }

  /**
   * A single unit reference.
   *
   * @patch 1.00
   */
  export interface unit extends widget { __unit: never; }

  /**
   * A single player reference.
   *
   * @patch 1.00
   */
  export interface player extends agent { __player: never; }

  /**
   * @ai-generated Fires when a unit of the registered player is attacked, as the attacker
   *   starts its attack. `GetAttacker` returns the attacker and `GetTriggerUnit` the attacked unit.
   *
   * @patch 1.00
   */
  export const EVENT_PLAYER_UNIT_ATTACKED: playerunitevent;

  /**
   * Returns: trigger
   *
   * Creates a new blank trigger object without any events, conditions or actions.
   *
   * @patch 1.00
   */
  export function CreateTrigger(): trigger;

  /**
   * Returns: event
   *
   * @ai-generated Registers the trigger to fire when the given event happens to any unit of the given player.
   *
   * @patch 1.00
   */
  export function TriggerRegisterPlayerUnitEvent(
    whichTrigger: trigger,
    whichPlayer: player,
    whichPlayerUnitEvent: playerunitevent,
    filter?: boolexpr,
  ): event;

  /**
   * Returns: triggeraction
   *
   * Adds an action to be called when the given trigger is fired through registered events or through `TriggerExecute`.
   *
   * @note More than one action can be added to the trigger. The actions run in the order they were added.
   * @note The same function can be used more than once on the same trigger.
   * @note Actions wait for their forerunner to finish. So if there are `TriggerSleepAction`s, subsequent actions will be delayed accordingly.
   * @note If an action execution crashes, subsequent actions will be unaffected and still be called.
   * @bug If an action execution crashes after a `TriggerSleepAction` in the same action execution, subsequent actions will not be run.
   * @note New actions added to the trigger during the execution of the actions won't be subject for execution for this run.
   * @patch 1.00
   */
  export function TriggerAddAction(whichTrigger: trigger, actionFunc: () => void): triggeraction;

  /**
   * Returns: unit
   *
   * Returns handle to unit which triggered the most recent event when called from
   * within a trigger action function. Returns `null` handle when used incorrectly.
   *
   * @note Can be used in `TriggerRegisterDeathEvent` if the dead widget is actually
   *   a unit.
   * @patch 1.00
   */
  export function GetTriggerUnit(): unit | null;

  /**
   * Returns: unit
   *
   * @ai-generated Returns the attacking unit when called from within a trigger action
   *   fired by `EVENT_PLAYER_UNIT_ATTACKED` or `EVENT_UNIT_ATTACKED`.
   *
   * @patch 1.00
   */
  export function GetAttacker(): unit | null;
}
