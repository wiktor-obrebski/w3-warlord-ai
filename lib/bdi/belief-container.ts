import type { AnyBeliefModel } from "./belief-model";

/**
 * The current Beliefs of every active belief model instance.
 *
 * A container is immutable: the belief runtime creates a new one each time it
 * revises Beliefs, so a container handed to execution components stays the
 * same for the rest of the tick.
 */
export class BeliefContainer {
  private readonly beliefs: ReadonlyMap<AnyBeliefModel, unknown>;

  /**
   * Takes ownership of `beliefs`, which must not be changed afterwards.
   */
  public constructor(beliefs: ReadonlyMap<AnyBeliefModel, unknown>) {
    this.beliefs = beliefs;
  }

  /**
   * Whether the container holds Beliefs of the model instance.
   */
  public has(model: AnyBeliefModel): boolean {
    return this.beliefs.has(model);
  }

  /**
   * Calls `callback` with every model instance the container holds Beliefs of.
   */
  public forEachModel(callback: (model: AnyBeliefModel) => void) {
    for (const model of this.beliefs.keys()) {
      callback(model);
    }
  }

  /**
   * The current Beliefs of the model instance. Throws when the model was not
   * active, i.e. not declared by any active execution component.
   */
  public get<TBeliefs>(model: AnyBeliefModel<TBeliefs>): Readonly<TBeliefs> {
    if (!this.beliefs.has(model)) {
      throw new Error("Beliefs: belief model is not active.");
    }

    return this.beliefs.get(model) as TBeliefs;
  }
}
