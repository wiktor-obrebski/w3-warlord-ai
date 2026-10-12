import {
  ActorControlArbiter,
  ActorControlPolicy,
  createActorControlArbiter,
} from '@lib/bdi';
import type { Actor, ActorControlRequest } from '../../contracts/actor-control';

export { createActorControl };

/**
 * An uncontrolled Actor is granted to any request; one controlled normally
 * only to a preemptive request; one controlled preemptively to none.
 */
const actorControlPolicy: ActorControlPolicy<ActorControlRequest> = ({
  request,
  currentClaim,
}) =>
  currentClaim === null ||
  (request === 'preemptive' && currentClaim.request !== 'preemptive');

/**
 * Creates the bot's actor control: the arbiter deciding which Plan or
 * Controller may order each Actor, under the bot's policy. Its
 * `actorControl` is the capability handed to components.
 */
function createActorControl(): ActorControlArbiter<Actor, ActorControlRequest> {
  return createActorControlArbiter<Actor, ActorControlRequest>({
    policy: actorControlPolicy,
  });
}
