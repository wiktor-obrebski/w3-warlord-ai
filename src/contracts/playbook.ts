import type { Beliefs } from './beliefs';
import type { WarlordProposal } from './desires';

export { type Playbook, type PlaybookPhase, type PlaybookPhaseArgs };

/** A strategy as data: its phases, in the order they begin. */
interface Playbook {
  readonly phases: readonly PlaybookPhase[];
}

interface PlaybookPhaseArgs {
  beliefs: Beliefs;
}

/**
 * A stage of a playbook. Phases begin in order, each once its condition
 * holds, and do not end: a phase lasts until the next one begins.
 */
interface PlaybookPhase {
  readonly name: string;

  /** Why the phase begins now, or null while it does not. */
  begins({ beliefs }: PlaybookPhaseArgs): string | null;

  /** The Desires the playbook proposes during the phase. */
  propose({ beliefs }: PlaybookPhaseArgs): readonly WarlordProposal[];
}
