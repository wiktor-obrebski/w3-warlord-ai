import type { AnyBeliefsModel } from './beliefs-model';

export { type Provided, type ChildHandle, type ChildFactory, childFactory };

/**
 * An Intention, Plan, or Controller as its provider function creates it:
 * the execution value, together with what the runtime needs to manage it.
 *
 * Providers are the only way components are constructed, so the runtime
 * always receives this metadata, while the component itself never sees it.
 */
interface Provided<TValue extends object, TCommonBeliefs> {
  readonly value: TValue;

  /**
   * Maintains the component's Scoped Beliefs. Omitted for a component with
   * only Common Beliefs.
   */
  readonly beliefsModel?: AnyBeliefsModel<TCommonBeliefs>;

  /**
   * The children the component currently has, as their providers created
   * them. The provider keeps this list up to date through child factories.
   */
  readonly children: readonly Provided<object, TCommonBeliefs>[];
}

/**
 * A child created by a child factory: its execution value, and a way for the
 * parent to give it up.
 */
interface ChildHandle<TValue> {
  readonly value: TValue;

  /**
   * Removes the child from its parent, so the runtime stops managing it:
   * its Scoped Beliefs and actor control are released.
   */
  discard(): void;
}

/**
 * Creates a child of the component it was given to.
 */
type ChildFactory<TValue> = () => ChildHandle<TValue>;

/**
 * Lets a provider give its component a way to create children without
 * exposing their metadata: each call provides a child, records it in
 * `children`, and hands the component only the child's value.
 */
function childFactory<TValue extends object, TCommonBeliefs>({
  children,
  provide,
}: {
  children: Provided<object, TCommonBeliefs>[];
  provide: () => Provided<TValue, TCommonBeliefs>;
}): ChildFactory<TValue> {
  return () => {
    const provided = provide();
    children.push(provided);

    return {
      value: provided.value,
      discard() {
        const index = children.indexOf(provided);

        if (index < 0) {
          throw new Error('Child factory: child already discarded.');
        }

        children.splice(index, 1);
      },
    };
  };
}
