import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { ActorControlPolicy, ActorControlProvider } from "@lib/bdi";

/**
 * A Warcraft entity the bot can order, such as a unit or a building; Warcraft
 * represents both as units.
 */
export type Actor = W3UnitApi.unit;

export interface ActorControlRequest {
  /**
   * Takes control from a source holding it normally. A preemptive claim is
   * itself never taken over.
   */
  readonly preempt?: boolean;
}

export type ActorControl = ActorControlProvider<Actor, ActorControlRequest>;

/**
 * An uncontrolled Actor is granted to any request; one controlled normally
 * only to a preemptive request; one controlled preemptively to none.
 */
export const actorControlPolicy: ActorControlPolicy<ActorControlRequest> = (
  request,
  current,
) =>
  current === undefined ||
  (request?.preempt === true && current.request?.preempt !== true);
