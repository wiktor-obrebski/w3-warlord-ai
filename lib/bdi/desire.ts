export {
  type DesireId,
  type DesireSupportId,
  type DesireOutcome,
  type Desire,
  type DesireSupport,
  type DesireExpression,
  type DesireExpressionProvider,
};

/**
 * Canonical identity of a desired outcome: equivalent outcomes have the same
 * id, whoever expresses them.
 */
type DesireId = string & { readonly __desireId: never };

/** Identity of one source's support for a Desire. */
type DesireSupportId = number & { readonly __desireSupportId: never };

/**
 * An outcome the agent may find desirable, such as acquiring an item for a
 * hero. `kind` names the sort of outcome; further fields, such as the hero
 * and the item, are part of its identity.
 */
interface DesireOutcome {
  readonly kind: string;
}

/**
 * An outcome the agent currently considers desirable, together with the
 * supports that make it so.
 *
 * Option Generation creates, updates, and retires Desires; a Desire object is
 * kept for as long as it remains desirable. It carries no behavior:
 * Deliberation decides which Intentions, if any, pursue it.
 */
interface Desire<TOutcome extends DesireOutcome> {
  readonly id: DesireId;
  readonly outcome: TOutcome;
  /** Every current support, each with its own importance. */
  readonly supports: readonly DesireSupport[];
}

/**
 * One source's expression of interest in a Desire. A source is an Intention
 * instance or, for permanent Desires, the agent itself.
 */
interface DesireSupport {
  readonly id: DesireSupportId;
  readonly desireId: DesireId;
  readonly source: object;
  /**
   * The importance the support currently contributes, which may fall below
   * the expressed one when its source stops refreshing it.
   */
  readonly importance: number;
}

/**
 * A desired outcome, with the importance its source gives it and how often
 * the source will confirm it.
 */
interface DesireExpression<TOutcome extends DesireOutcome> {
  outcome: TOutcome;
  importance: number;
  /**
   * The interval, in game seconds, at which the source calls `support()`.
   * A support refreshed at this pace keeps its full importance.
   */
  refreshSeconds: number;
}

interface DesireExpressionProviderSupportArgs {
  supportId: DesireSupportId;
  importance?: number;
}

interface DesireExpressionProviderReplaceArgs<
  TOutcome extends DesireOutcome,
> extends DesireExpression<TOutcome> {
  supportId: DesireSupportId;
}

/**
 * Lets Intentions express the outcomes they want. It always acts for the
 * Intention whose update is running, so one provider serves every Intention,
 * and an Intention can touch only the supports it owns. Using it outside an
 * Intention update, or with a support id the Intention does not own, throws.
 *
 * A support its source stops refreshing loses importance and eventually
 * expires, at a pace the implementation decides. An Intention leaving the
 * component tree loses all its supports at once.
 */
interface DesireExpressionProvider<TOutcome extends DesireOutcome> {
  /**
   * Adds a new support for the outcome's Desire, which equivalent outcomes
   * share, and returns its id.
   */
  express({
    outcome,
    importance,
    refreshSeconds,
  }: DesireExpression<TOutcome>): DesireSupportId;

  /**
   * Confirms the support, keeping it fresh, and optionally changes its
   * importance. Called on every regular evaluation instead of expressing the
   * outcome again.
   */
  support({ supportId, importance }: DesireExpressionProviderSupportArgs): void;

  /** Removes the support immediately; other supports are unaffected. */
  withdraw({ supportId }: { supportId: DesireSupportId }): void;

  /**
   * Withdraws the support and expresses a possibly different outcome in its
   * place, at once. Returns the new support's id.
   */
  replace({
    supportId,
    outcome,
    importance,
    refreshSeconds,
  }: DesireExpressionProviderReplaceArgs<TOutcome>): DesireSupportId;
}
