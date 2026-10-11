import type { ActorControlProvider } from "./actor-control";
import type { ExecutionComponent } from "./execution-component";

/**
 * Continuous reactive behavior with no procedural completion.
 *
 * A Controller may keep private execution state but treats Beliefs as
 * read-only input.
 */
export interface Controller<TBeliefs, TActor> extends ExecutionComponent {
  /**
   * Reacts to the current Beliefs. It may order only the Actors `control`
   * grants it.
   */
  update(beliefs: Readonly<TBeliefs>, control: ActorControlProvider<TActor>): void;
}
