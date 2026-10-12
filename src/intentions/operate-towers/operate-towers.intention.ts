import { ChildFactory, childFactory } from '@lib/bdi';
import {
  ProvidedChildren,
  ProvidedComponent,
  WarlordBeliefs,
  WarlordController,
  WarlordIntention,
  WarlordUpdateChild,
} from '../../execution';
import { UpdateInterval } from '../update-interval';
import { provideTowerTargetSelectionController } from './tower-target-selection.ctrl';

export { provideOperateTowersIntention };

const UpdateSeconds = 1;

interface OperateTowersIntentionConstructorArgs {
  createTargetSelection: ChildFactory<WarlordController>;
}

interface OperateTowersIntentionUpdateArgs {
  beliefs: WarlordBeliefs;
  updateChild: WarlordUpdateChild;
}

/** Directs the fire of the bot's Guard Towers. */
class OperateTowersIntention implements WarlordIntention {
  private readonly interval = new UpdateInterval({ seconds: UpdateSeconds });
  private readonly createTargetSelection: ChildFactory<WarlordController>;
  private targetSelection: WarlordController | null = null;

  public constructor({
    createTargetSelection,
  }: OperateTowersIntentionConstructorArgs) {
    this.createTargetSelection = createTargetSelection;
  }

  public update({ beliefs, updateChild }: OperateTowersIntentionUpdateArgs) {
    if (this.interval.claim({ now: beliefs.common.time })) {
      this.targetSelection ??= this.createTargetSelection().value;
      updateChild({ child: this.targetSelection });
    }
  }
}

function provideOperateTowersIntention(): ProvidedComponent<WarlordIntention> {
  const children: ProvidedChildren = [];

  return {
    value: new OperateTowersIntention({
      createTargetSelection: childFactory({
        children,
        provide: () => provideTowerTargetSelectionController(),
      }),
    }),
    children,
  };
}
