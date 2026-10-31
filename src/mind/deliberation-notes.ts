import {
  RANK,
  type IntentionChange,
  type IntentionEvent,
  type SourcedProposal,
} from '@lib/chain-of-command';
import type { WarlordDesire, WarlordOutcome } from '../contracts/desires';
import type { WarlordIntention } from '../contracts/intentions';
import type { DecisionRecorder } from '../contracts/record';

export { noteDesireChanges, noteIntentionEvents, noteAgendaChange };

interface NoteDesireChangesArgs {
  previousDesires: readonly WarlordDesire[];
  desires: readonly WarlordDesire[];
  recorder: DecisionRecorder;
}

/** Notes the Desires that appeared, changed their best proposal, or went. */
function noteDesireChanges({
  previousDesires,
  desires,
  recorder,
}: NoteDesireChangesArgs) {
  for (const previous of previousDesires) {
    if (!desires.some((desire) => desire.id === previous.id)) {
      recorder.note({
        message: `Desire gone: ${previous.id}.`,
        fields: { desire: previous.id },
      });
    }
  }

  for (const desire of desires) {
    const previous = previousDesires.find(
      (candidate) => candidate.id === desire.id
    );

    if (!previous || !isSameProposal({ a: previous.best, b: desire.best })) {
      const { source, rank, weight, reason } = desire.best;

      recorder.note({
        message: `Desire ${previous ? 'changed' : 'appeared'}: ${desire.id} (${describeProposal({ proposal: desire.best })}).`,
        fields: { desire: desire.id, source, rank: RANK[rank], weight, reason },
      });
    }
  }
}

interface NoteIntentionEventsArgs {
  events: readonly IntentionEvent[];
  recorder: DecisionRecorder;
}

function noteIntentionEvents({ events, recorder }: NoteIntentionEventsArgs) {
  for (const { intention, change, plan, reason } of events) {
    const fields: Record<string, string> = { intention, change };
    let message = `Intention ${intention}: ${ChangeTexts[change]}`;

    if (plan !== undefined) {
      fields.plan = plan;
      message += ` "${plan}"`;
    }

    if (reason !== undefined) {
      fields.reason = reason;
      message += ` (${reason})`;
    }

    recorder.note({ message: `${message}.`, fields });
  }
}

interface NoteAgendaChangeArgs {
  previousAgenda: readonly WarlordIntention[];
  agenda: readonly WarlordIntention[];
  recorder: DecisionRecorder;
}

function noteAgendaChange({
  previousAgenda,
  agenda,
  recorder,
}: NoteAgendaChangeArgs) {
  const previousOrder = previousAgenda
    .map(({ desireId }) => desireId)
    .join(', ');
  const order = agenda.map(({ desireId }) => desireId).join(', ');

  if (order !== previousOrder) {
    recorder.note({
      message: `Agenda: ${agenda.length > 0 ? order : 'empty'}.`,
      fields: { agenda: order },
    });
  }
}

const ChangeTexts: Readonly<Record<IntentionChange, string>> = {
  adopted: 'adopted',
  paused: 'paused',
  resumed: 'resumed',
  achieved: 'achieved',
  failed: 'failed',
  dropped: 'dropped',
  planStarted: 'started plan',
  planSucceeded: 'plan succeeded',
  planFailed: 'plan failed',
};

interface IsSameProposalArgs {
  a: SourcedProposal<WarlordOutcome>;
  b: SourcedProposal<WarlordOutcome>;
}

function isSameProposal({ a, b }: IsSameProposalArgs): boolean {
  return (
    a.source === b.source &&
    a.rank === b.rank &&
    a.weight === b.weight &&
    a.reason === b.reason
  );
}

interface DescribeProposalArgs {
  proposal: SourcedProposal<WarlordOutcome>;
}

function describeProposal({ proposal }: DescribeProposalArgs): string {
  const { source, rank, weight, reason } = proposal;

  return weight > 0
    ? `${RANK[rank]}, weight ${weight}, from the ${source}: ${reason}`
    : `vetoed by the ${source}: ${reason}`;
}
