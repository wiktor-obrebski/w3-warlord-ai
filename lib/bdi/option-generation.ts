import type { Desire, DesireExpressionProvider, DesireOutcome } from './desire';

export { type OptionGeneration };

interface OptionGenerationUpdateArgs {
  source: object;
  now: number;
  run: () => void;
}

interface OptionGenerationReleaseInactiveArgs {
  activeSources: ReadonlySet<object>;
}

interface OptionGenerationGenerateArgs {
  now: number;
}

/**
 * Determines which outcomes the agent currently considers desirable: it
 * resolves the supports Intentions express into canonical Desires, together
 * with the agent's permanent Desires, and retires Desires no longer
 * supported.
 *
 * It decides what is worth pursuing, not what the agent commits to; that is
 * Deliberation's decision.
 */
interface OptionGeneration<TOutcome extends DesireOutcome> {
  /**
   * The desire expression given to every Intention. It acts for the
   * Intention whose update is running and throws outside of one.
   */
  readonly desireExpression: DesireExpressionProvider<TOutcome>;

  /**
   * Runs one update of the Intention, during which `desireExpression` acts
   * for it. `now` is the current game time, in seconds.
   */
  update({ source, now, run }: OptionGenerationUpdateArgs): void;

  /**
   * Withdraws the supports of Intentions no longer active, which will not
   * update again to withdraw them.
   */
  releaseInactive({ activeSources }: OptionGenerationReleaseInactiveArgs): void;

  /**
   * Returns the current Desires, as of game time `now`. A Desire keeps its
   * object for as long as it remains desirable; Desires expressed since the
   * previous call appear now.
   */
  generate({ now }: OptionGenerationGenerateArgs): {
    desires: readonly Desire<TOutcome>[];
  };
}
