import type {
  DesireExpression,
  DesireId,
  DesireSupport,
  DesireSupportId,
  OptionGeneration,
} from '@lib/bdi';
import type {
  WarlordDesire,
  WarlordDesireOutcome,
} from '../../contracts/desires';

export { createOptionGeneration };

interface CreateOptionGenerationArgs {
  /**
   * The canonical identity of an outcome: equal for equivalent outcomes,
   * different for different ones.
   */
  identify: ({ outcome }: { outcome: WarlordDesireOutcome }) => string;
  /** Outcomes desirable for the whole game, whoever else supports them. */
  permanentDesires: readonly WarlordDesireOutcome[];
}

/**
 * Creates the bot's Option Generation.
 *
 * A support stays fresh for its `refreshSeconds` after each refresh. Once
 * stale, its importance decays linearly to zero over `DecayIntervals` more
 * of its intervals, and then it expires. Permanent supports never go stale.
 */
function createOptionGeneration({
  identify,
  permanentDesires,
}: CreateOptionGenerationArgs): OptionGeneration<WarlordDesireOutcome> {
  const supports = new Map<DesireSupportId, SupportRecord>();
  const desires = new Map<DesireId, GeneratedDesire>();
  let lastSupportId = 0;
  let runningUpdate: SourceUpdate | null = null;

  const addSupport = ({
    source,
    permanent,
    now,
    outcome,
    importance,
    refreshSeconds,
  }: AddSupportArgs): DesireSupportId => {
    lastSupportId += 1;
    const id = lastSupportId as DesireSupportId;

    supports.set(id, {
      id,
      desireId: identify({ outcome }) as DesireId,
      source,
      permanent,
      outcome,
      importance,
      expressedImportance: importance,
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

  const expressAs = ({ expression }: ExpressAsArgs): DesireSupportId => {
    const { source, now } = sourceUpdate();

    if (expression.refreshSeconds <= 0) {
      throw new Error('Option generation: refreshSeconds must be positive.');
    }

    return addSupport({ source, permanent: false, now, ...expression });
  };

  const ownedSupport = ({ supportId }: OwnedSupportArgs): OwnedSupport => {
    const { source, now } = sourceUpdate();
    const support = supports.get(supportId);

    if (support === undefined || support.source !== source) {
      throw new Error(
        `Option generation: support ${supportId} is not a current support of the updating Intention.`
      );
    }

    return { support, now };
  };

  const removeSupports = ({ shouldRemove }: RemoveSupportsArgs) => {
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

  const staleSecondsOf = ({ support, now }: SupportAtArgs) =>
    now - support.lastRefreshedAt - support.refreshSeconds;

  const isExpired = ({ support, now }: SupportAtArgs) =>
    !support.permanent &&
    staleSecondsOf({ support, now }) >= support.refreshSeconds * DecayIntervals;

  const decay = ({ support, now }: SupportAtArgs) => {
    const staleSeconds = staleSecondsOf({ support, now });

    support.importance =
      staleSeconds <= 0
        ? support.expressedImportance
        : support.expressedImportance *
          (1 - staleSeconds / (support.refreshSeconds * DecayIntervals));
  };

  for (const outcome of permanentDesires) {
    addSupport({
      source: AgentSource,
      permanent: true,
      now: 0,
      outcome,
      importance: PermanentImportance,
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
          support.expressedImportance = importance;
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

      const supportsByDesire = new Map<DesireId, SupportRecord[]>();

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

const DecayIntervals = 2;
const PermanentImportance = 1;

// The source of the permanent Desires' supports.
const AgentSource = {};

interface SupportRecord extends DesireSupport {
  readonly outcome: WarlordDesireOutcome;
  readonly permanent: boolean;
  importance: number;
  expressedImportance: number;
  refreshSeconds: number;
  // Game seconds at which the source last expressed or refreshed it.
  lastRefreshedAt: number;
}

interface GeneratedDesire extends WarlordDesire {
  supports: SupportRecord[];
}

interface SourceUpdate {
  source: object;
  now: number;
}

interface AddSupportArgs extends DesireExpression<WarlordDesireOutcome> {
  source: object;
  permanent: boolean;
  now: number;
}

interface ExpressAsArgs {
  expression: DesireExpression<WarlordDesireOutcome>;
}

interface OwnedSupportArgs {
  supportId: DesireSupportId;
}

interface OwnedSupport {
  support: SupportRecord;
  now: number;
}

interface RemoveSupportsArgs {
  shouldRemove: ({ support }: { support: SupportRecord }) => boolean;
}

interface SupportAtArgs {
  support: SupportRecord;
  now: number;
}
