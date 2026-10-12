import * as W3UnitApi from '@lib/warcraft3-api/unit';
import { ActorControlPolicy, ActorControlProvider } from '@lib/bdi';

export {
  type Actor,
  type ActorControlRequest,
  NORMAL_REQUEST,
  PREEMPTIVE_REQUEST,
  type ActorControl,
  actorControlPolicy,
};

/**
 * A Warcraft entity the bot can order, such as a unit or a building; Warcraft
 * represents both as units.
 */
type Actor = W3UnitApi.unit;

interface ActorControlRequest {
  /**
   * Whether the request takes control from a source holding it normally. A
   * preemptive claim is itself never taken over.
   */
  readonly preemptive: boolean;
}

const NORMAL_REQUEST: ActorControlRequest = { preemptive: false };
const PREEMPTIVE_REQUEST: ActorControlRequest = { preemptive: true };

type ActorControl = ActorControlProvider<Actor, ActorControlRequest>;

/**
 * An uncontrolled Actor is granted to any request; one controlled normally
 * only to a preemptive request; one controlled preemptively to none.
 */
const actorControlPolicy: ActorControlPolicy<ActorControlRequest> = ({
  request,
  currentClaim,
}) =>
  currentClaim === null ||
  (request.preemptive && !currentClaim.request.preemptive);
