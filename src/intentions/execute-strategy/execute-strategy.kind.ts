import type { PlanRunStepArgs, PlanStep } from '@lib/chain-of-command';
import type { Beliefs } from '../../contracts/beliefs';
import type {
  ExecuteStrategy,
  PlaybookName,
  WarlordProposal,
} from '../../contracts/desires';
import type { UnitId } from '../../contracts/ids';
import type {
  WarlordIntentionKind,
  WarlordPlanRun,
  WarlordResource,
} from '../../contracts/intentions';
import type { Playbook } from '../../contracts/playbook';
import type { DecisionRecorder } from '../../contracts/record';

export { createExecuteStrategyKind, type ExecuteStrategyCapabilities };

interface ExecuteStrategyCapabilities {
  readonly playbooks: Readonly<Record<PlaybookName, Playbook>>;
  readonly recorder: DecisionRecorder;
}

interface CreateExecuteStrategyKindArgs {
  capabilities: ExecuteStrategyCapabilities;
}

/**
 * The committed strategy: it follows its playbook's phases and proposes
 * each phase's Desires. It needs nothing itself.
 */
function createExecuteStrategyKind({
  capabilities,
}: CreateExecuteStrategyKindArgs): WarlordIntentionKind<ExecuteStrategy> {
  return {
    paceSeconds: 1,
    failure: { excludeSeconds: 10, attempts: 1, whenExhausted: 'recur' },
    plans: [
      {
        name: 'follow the playbook',
        preference: 0,

        applicable() {
          return true;
        },

        start({ goal }) {
          return new PlaybookRun({
            playbookName: goal.playbook,
            playbook: capabilities.playbooks[goal.playbook],
            recorder: capabilities.recorder,
          });
        },
      },
    ],
  };
}

interface PlaybookRunConstructorArgs {
  playbookName: PlaybookName;
  playbook: Playbook;
  recorder: DecisionRecorder;
}

class PlaybookRun implements WarlordPlanRun {
  private readonly playbookName: PlaybookName;
  private readonly playbook: Playbook;
  private readonly recorder: DecisionRecorder;
  // The index of the phase in effect; -1 before the first one begins.
  private phase = -1;

  public constructor({
    playbookName,
    playbook,
    recorder,
  }: PlaybookRunConstructorArgs) {
    this.playbookName = playbookName;
    this.playbook = playbook;
    this.recorder = recorder;
  }

  public step({
    beliefs,
  }: PlanRunStepArgs<Beliefs, UnitId, WarlordResource>): PlanStep {
    let next = this.playbook.phases[this.phase + 1];

    while (next) {
      const reason = next.begins({ beliefs });

      if (reason === null) {
        break;
      }

      this.phase += 1;
      this.recorder.note({
        message: `${this.playbookName}: phase ${next.name} begins (${reason}).`,
        fields: { playbook: this.playbookName, phase: next.name },
      });
      next = this.playbook.phases[this.phase + 1];
    }

    return { status: 'running' };
  }

  public requests({
    beliefs,
  }: {
    beliefs: Beliefs;
  }): readonly WarlordProposal[] {
    return this.playbook.phases[this.phase]?.propose({ beliefs }) ?? [];
  }
}
