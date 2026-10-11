import type { ExecutionComponent } from "./execution-component";

/**
 * Continuous reactive behavior with no procedural completion.
 *
 * A Controller may keep private execution state but treats Beliefs as
 * read-only input. `TControl` is the agent's actor control capability,
 * normally an `ActorControlProvider`.
 */
export interface Controller<TBeliefs, TControl> extends ExecutionComponent {
  /**
   * Reacts to the current Beliefs. It may order only the Actors `control`
   * grants it.
   */
  update(beliefs: Readonly<TBeliefs>, control: TControl): void;
}
