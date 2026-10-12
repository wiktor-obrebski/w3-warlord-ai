import type * as W3UnitApi from '@lib/warcraft3-api/unit';
import type { ActorControlProvider } from '@lib/bdi';

export { type Actor, type ActorControlRequest, type ActorControl };

/**
 * A Warcraft entity the bot can order, such as a unit or a building; Warcraft
 * represents both as units.
 */
type Actor = W3UnitApi.unit;

/**
 * How a source asks for an Actor. A preemptive request also takes control
 * from a source holding it normally; a preemptive claim is itself never
 * taken over.
 */
type ActorControlRequest = 'normal' | 'preemptive';

type ActorControl = ActorControlProvider<Actor, ActorControlRequest>;
