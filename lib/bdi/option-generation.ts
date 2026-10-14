import type {
  Desire,
  DesireExpression,
  DesireExpressionProvider,
  DesireId,
  DesireOutcome,
  DesireSupport,
  DesireSupportId,
} from './desire';

export { type OptionGeneration, createOptionGeneration };

interface OptionGenerationUpdateArgs {
  source: object;
  now: number;
  run: () => void;
}

interface OptionGenerationReleaseInactiveArgs {
  activeSources: ReadonlySet<object>;
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
   * Decays stale supports, expires those stale for too long, and returns the
   * current Desires. A Desire keeps its object for as long as it has
   * supports; Desires expressed since the previous call appear now.
   */
  generate({ now }: { now: number }): {
    desires: readonly Desire<TOutcome>[];
  };
}

interface CreateOptionGenerationArgs<TOutcome extends DesireOutcome> {
  /**
   * The canonical identity of an outcome: equal for equivalent outcomes,
   * different for different ones.
   */
  identify: ({ outcome }: { outcome: TOutcome }) => string;
  /**
   * Outcomes desirable for the whole game, with full importance, whoever
   * else supports them.
   */
  permanentDesires: readonly TOutcome[];
  /**
   * How long a stale support keeps decaying before it expires, in multiples
   * of its own `refreshSeconds`.
   */
  decayIntervals: number;
}

function createOptionGeneration<TOutcome extends DesireOutcome>({
  identify,
  permanentDesires,
  decayIntervals,
}: CreateOptionGenerationArgs<TOutcome>): OptionGeneration<TOutcome> {
  const supports = new Map<DesireSupportId, SupportRecord<TOutcome>>();
  const desires = new Map<DesireId, GeneratedDesire<TOutcome>>();
  let lastSupportId = 0;
  let runningUpdate: SourceUpdate | null = null;

  const addSupport = ({
    source,
    permanent,
    now,
    outcome,
    importance,
    refreshSeconds,
  }: AddSupportArgs<TOutcome>): DesireSupportId => {
    lastSupportId += 1;
    const id = lastSupportId as DesireSupportId;

    supports.set(id, {
      id,
      desireId: identify({ outcome }) as DesireId,
      source,
      permanent,
      outcome,
      importance,
      currentImportance: importance,
      refreshSeconds,
      lastRefreshedAt: now,
    });

    return id;
  };

  const sourceUpdate = (): SourceUpdate => {
    if (runningUpdate === null) {
      throw new Error(
        'Option generation: desire expressed outside an Intention update.'
      );
    }

    return runningUpdate;
  };

  const expressAs = ({
    expression,
  }: {
    expression: DesireExpression<TOutcome>;
  }): DesireSupportId => {
    const { source, now } = sourceUpdate();

    if (expression.refreshSeconds <= 0) {
      throw new Error('Option generation: refreshSeconds must be positive.');
    }

    return addSupport({ source, permanent: false, now, ...expression });
  };

  const ownedSupport = ({
    supportId,
  }: {
    supportId: DesireSupportId;
  }): { support: SupportRecord<TOutcome>; now: number } => {
    const { source, now } = sourceUpdate();
    const support = supports.get(supportId);

    if (support === undefined || support.source !== source) {
      throw new Error(
        `Option generation: support ${supportId} is not a current support of the updating Intention.`
      );
    }

    return { support, now };
  };

  const removeSupports = ({ shouldRemove }: RemoveSupportsArgs<TOutcome>) => {
    const removed: DesireSupportId[] = [];

    for (const [supportId, support] of supports) {
      if (shouldRemove({ support })) {
        removed.push(supportId);
      }
    }

    for (const supportId of removed) {
      supports.delete(supportId);
    }
  };

  const decay = ({ support, now }: DecayArgs<TOutcome>) => {
    const staleSeconds = now - support.lastRefreshedAt - support.refreshSeconds;
    const decaySeconds = support.refreshSeconds * decayIntervals;

    support.currentImportance =
      staleSeconds <= 0
        ? support.importance
        : support.importance * (1 - staleSeconds / decaySeconds);
  };

  const isExpired = ({ support, now }: DecayArgs<TOutcome>) =>
    !support.permanent &&
    now - support.lastRefreshedAt >=
      support.refreshSeconds * (1 + decayIntervals);

  for (const outcome of permanentDesires) {
    addSupport({
      source: AgentSource,
      permanent: true,
      now: 0,
      outcome,
      importance: 1,
      refreshSeconds: 0,
    });
  }

  return {
    desireExpression: {
      express(expression) {
        return expressAs({ expression });
      },

      support({ supportId, importance }) {
        const { support, now } = ownedSupport({ supportId });

        support.lastRefreshedAt = now;

        if (importance !== undefined) {
          support.importance = importance;
        }
      },

      withdraw({ supportId }) {
        ownedSupport({ supportId });
        supports.delete(supportId);
      },

      replace({ supportId, ...expression }) {
        ownedSupport({ supportId });
        supports.delete(supportId);

        return expressAs({ expression });
      },
    },

    update({ source, now, run }) {
      // Not reset in a `finally`: TSTL rethrows from it, so the error report
      // would lose the original traceback. An error ends the cycle, and the
      // next update replaces the stale value.
      runningUpdate = { source, now };
      run();
      runningUpdate = null;
    },

    releaseInactive({ activeSources }) {
      removeSupports({
        shouldRemove: ({ support }) =>
          !support.permanent && !activeSources.has(support.source),
      });
    },

    generate({ now }) {
      removeSupports({
        shouldRemove: ({ support }) => isExpired({ support, now }),
      });

      const supportsByDesire = new Map<DesireId, SupportRecord<TOutcome>[]>();

      for (const support of supports.values()) {
        if (!support.permanent) {
          decay({ support, now });
        }

        if (!desires.has(support.desireId)) {
          desires.set(support.desireId, {
            id: support.desireId,
            outcome: support.outcome,
            supports: [],
          });
        }

        const desireSupports = supportsByDesire.get(support.desireId);

        if (desireSupports) {
          desireSupports.push(support);
        } else {
          supportsByDesire.set(support.desireId, [support]);
        }
      }

      const retired: DesireId[] = [];

      for (const desire of desires.values()) {
        const desireSupports = supportsByDesire.get(desire.id);

        if (desireSupports) {
          desire.supports = desireSupports;
        } else {
          retired.push(desire.id);
        }
      }

      for (const desireId of retired) {
        desires.delete(desireId);
      }

      return { desires: [...desires.values()] };
    },
  };
}

// The source of the permanent Desires' supports.
const AgentSource = {};

interface SupportRecord<TOutcome> extends DesireSupport {
  readonly outcome: TOutcome;
}

interface GeneratedDesire<
  TOutcome extends DesireOutcome,
> extends Desire<TOutcome> {
  supports: SupportRecord<TOutcome>[];
}

interface SourceUpdate {
  source: object;
  now: number;
}

interface AddSupportArgs<
  TOutcome extends DesireOutcome,
> extends DesireExpression<TOutcome> {
  source: object;
  permanent: boolean;
  now: number;
}

interface RemoveSupportsArgs<TOutcome> {
  shouldRemove: ({ support }: { support: SupportRecord<TOutcome> }) => boolean;
}

interface DecayArgs<TOutcome> {
  support: SupportRecord<TOutcome>;
  now: number;
}
