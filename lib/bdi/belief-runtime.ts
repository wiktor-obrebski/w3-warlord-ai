import type { AnyBeliefModel } from "./belief-model";
import { BeliefContainer } from "./belief-container";
import type { ExecutionComponent } from "./execution-component";

/**
 * The belief models declared by the components and all their active
 * descendants, each listed once.
 */
export function requiredBeliefModels(
  components: readonly ExecutionComponent[],
): AnyBeliefModel[] {
  const models: AnyBeliefModel[] = [];
  const found = new Set<AnyBeliefModel>();

  const visit = (component: ExecutionComponent) => {
    for (const model of component.beliefModels ?? []) {
      if (!found.has(model)) {
        found.add(model);
        models.push(model);
      }
    }

    for (const child of component.activeChildren?.() ?? []) {
      visit(child);
    }
  };

  for (const component of components) {
    visit(component);
  }

  return models;
}

/**
 * Revises the models and their dependencies, dependencies first, into a new
 * container holding exactly those Beliefs together with `revised`.
 *
 * Each model is observed and revised once, from its Beliefs in `previous`, or
 * from undefined when it was not active then. Models already in `revised`
 * were revised earlier in the same tick and are kept as they are. Beliefs of
 * models no longer required are dropped.
 */
export function reviseBeliefs(
  models: readonly AnyBeliefModel[],
  previous: BeliefContainer | undefined,
  revised?: BeliefContainer,
): BeliefContainer {
  const current = new Map<AnyBeliefModel, unknown>();
  const revising = new Set<AnyBeliefModel>();

  const revise = (model: AnyBeliefModel) => {
    if (current.has(model)) {
      return;
    }

    if (revised?.has(model)) {
      current.set(model, revised.get(model));
      return;
    }

    if (revising.has(model)) {
      throw new Error("Beliefs: belief model dependencies form a cycle.");
    }

    revising.add(model);

    const { dependencies } = model;
    let dependencyBeliefs: Record<string, unknown> | undefined;

    if (dependencies) {
      dependencyBeliefs = {};

      for (const [key, dependency] of Object.entries(dependencies)) {
        revise(dependency);
        dependencyBeliefs[key] = current.get(dependency);
      }
    }

    current.set(
      model,
      model.revise(
        previous?.has(model) ? previous.get(model) : undefined,
        model.observe(),
        dependencyBeliefs,
      ),
    );
    revising.delete(model);
  };

  for (const model of models) {
    revise(model);
  }

  if (revised) {
    revised.forEachModel(revise);
  }

  return new BeliefContainer(current);
}
