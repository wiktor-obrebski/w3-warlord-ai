import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { ActorControlProvider } from "@lib/bdi";

/**
 * A Warcraft entity the bot can order, such as a unit or a building; Warcraft
 * represents both as units.
 */
export type Actor = W3UnitApi.unit;

export type ActorControl = ActorControlProvider<Actor>;
