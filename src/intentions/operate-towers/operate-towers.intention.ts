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

/** Directs the fire of the bot's Guard Towers. */
class OperateTowersIntention implements WarlordIntention {
  private readonly interval = new UpdateInterval({ seconds: UpdateSeconds });
  private readonly createTargetSelection: ChildFactory<WarlordController>;
  private targetSelection: WarlordController | null = null;

  public constructor({
    createTargetSelection,
  }: {
    createTargetSelection: ChildFactory<WarlordController>;
  }) {
    this.createTargetSelection = createTargetSelection;
  }

  public update({
    beliefs,
    updateChild,
  }: {
    beliefs: WarlordBeliefs;
    updateChild: WarlordUpdateChild;
  }) {
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
