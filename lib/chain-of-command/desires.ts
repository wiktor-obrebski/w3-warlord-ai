export {
  RANK,
  type Proposal,
  type ProposalSource,
  type SourcedProposal,
  type Desire,
  collectDesires,
  strongerFirst,
};

/** A proposal's category, from the lowest. A higher rank always comes first. */
enum RANK {
  BACKGROUND = 1,
  OPPORTUNITY,
  GAME_PLAN,
  EMERGENCY,
  SURVIVAL,
}

/** One source backing one outcome: how strongly, and why. */
interface Proposal<TOutcome> {
  readonly outcome: TOutcome;
  readonly rank: RANK;
  // The value within the rank, on one scale for every proposal. A weight of
  // 0 vetoes the proposal.
  readonly weight: number;
  readonly reason: string;
}

/** What one source, such as a concern, proposes in a deliberation cycle. */
interface ProposalSource<TOutcome> {
  readonly name: string;
  readonly proposals: readonly Proposal<TOutcome>[];
}

interface SourcedProposal<TOutcome> extends Proposal<TOutcome> {
  readonly source: string;
}

/**
 * An outcome worth pursuing, backed by every proposal for it in the cycle.
 * It ranks as its best proposal: the highest rank, then the highest weight.
 */
interface Desire<TOutcome> {
  // The outcome's identity: its kind and its arguments.
  readonly id: string;
  readonly outcome: TOutcome;
  readonly best: SourcedProposal<TOutcome>;
  readonly proposals: readonly SourcedProposal<TOutcome>[];
}

interface CollectDesiresArgs<TOutcome> {
  sources: readonly ProposalSource<TOutcome>[];
  // Equal for equal outcomes, different for different ones.
  identify: ({ outcome }: { outcome: TOutcome }) => string;
}

/**
 * Merges the proposals of every source into Desires, one per outcome, in the
 * order their outcomes are first proposed.
 */
function collectDesires<TOutcome>({
  sources,
  identify,
}: CollectDesiresArgs<TOutcome>): Desire<TOutcome>[] {
  const proposalsById = new Map<string, SourcedProposal<TOutcome>[]>();

  for (const { name, proposals } of sources) {
    for (const proposal of proposals) {
      const id = identify({ outcome: proposal.outcome });
      const sourced = { ...proposal, source: name };
      const known = proposalsById.get(id);

      if (known) {
        known.push(sourced);
      } else {
        proposalsById.set(id, [sourced]);
      }
    }
  }

  const desires: Desire<TOutcome>[] = [];

  for (const [id, proposals] of proposalsById) {
    const best = strongestProposal({ proposals });

    desires.push({ id, outcome: best.outcome, best, proposals });
  }

  return desires;
}

/** Orders proposals from the strongest: by rank, then by weight. */
function strongerFirst<TOutcome>(
  a: Proposal<TOutcome>,
  b: Proposal<TOutcome>
): number {
  return a.rank === b.rank ? b.weight - a.weight : b.rank - a.rank;
}

interface StrongestProposalArgs<TOutcome> {
  proposals: readonly SourcedProposal<TOutcome>[];
}

// Of equally strong proposals, the first one proposed.
function strongestProposal<TOutcome>({
  proposals,
}: StrongestProposalArgs<TOutcome>): SourcedProposal<TOutcome> {
  let strongest: SourcedProposal<TOutcome> | undefined;

  for (const proposal of proposals) {
    if (!strongest || strongerFirst(proposal, strongest) < 0) {
      strongest = proposal;
    }
  }

  if (!strongest) {
    throw new Error('Desires: a Desire without proposals.');
  }

  return strongest;
}
