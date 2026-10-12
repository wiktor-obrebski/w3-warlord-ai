import type { BeliefsModel } from './beliefs-model';

export {
  type AssembledComponent,
  type ChildHandle,
  type ChildFactory,
  childFactory,
};

/**
 * An Intention, Plan, or Controller as its assemble function builds it: the
 * component, together with what the runtime needs to manage it.
 *
 * Assemble functions are the only way components are constructed, so the
 * runtime always receives this metadata, while the component itself never
 * sees it.
 *
 * An assemble function names the Scoped Beliefs type its component reads as
 * `TScopedBeliefs`, so the compiler checks that the model produces it. The
 * runtime handles components of every Scoped Beliefs type alike, so the
 * default `unknown` is what it receives.
 */
interface AssembledComponent<
  TComponent extends object,
  TCommonBeliefs,
  TScopedBeliefs = unknown,
> {
  readonly component: TComponent;

  /**
   * Maintains the component's Scoped Beliefs. Omitted for a component with
   * only Common Beliefs.
   */
  readonly beliefsModel?: BeliefsModel<TScopedBeliefs, TCommonBeliefs>;

  /**
   * The children the component currently has, as their assemble functions
   * built them. The assemble function keeps this list up to date through
   * child factories.
   */
  readonly children: readonly AssembledComponent<object, TCommonBeliefs>[];
}

/**
 * A child created by a child factory: the component, and a way for the
 * parent to give it up.
 */
interface ChildHandle<TComponent> {
  readonly component: TComponent;

  /**
   * Removes the child from its parent, so the runtime stops managing it:
   * its Scoped Beliefs and actor control are released.
   */
  discard(): void;
}

/**
 * Creates a child of the component it was given to.
 */
type ChildFactory<TComponent> = () => ChildHandle<TComponent>;

interface ChildFactoryArgs<TComponent extends object, TCommonBeliefs> {
  children: AssembledComponent<object, TCommonBeliefs>[];
  assemble: () => AssembledComponent<TComponent, TCommonBeliefs>;
}

/**
 * Lets an assemble function give its component a way to create children
 * without exposing their metadata: each call assembles a child, records it in
 * `children`, and hands the component only a handle to the child.
 */
function childFactory<TComponent extends object, TCommonBeliefs>({
  children,
  assemble,
}: ChildFactoryArgs<TComponent, TCommonBeliefs>): ChildFactory<TComponent> {
  return () => {
    const assembledChild = assemble();
    children.push(assembledChild);

    return {
      component: assembledChild.component,
      discard() {
        const index = children.indexOf(assembledChild);

        if (index < 0) {
          throw new Error('Child factory: child already discarded.');
        }

        children.splice(index, 1);
      },
    };
  };
}
