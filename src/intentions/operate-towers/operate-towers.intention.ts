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

const UPDATE_SECONDS = 1;

/** Directs the fire of the bot's Guard Towers. */
class OperateTowersIntention implements WarlordIntention {
  private readonly interval = new UpdateInterval(UPDATE_SECONDS);
  private readonly createTargetSelection: ChildFactory<WarlordController>;
  private targetSelection: WarlordController | null = null;

  public constructor(createTargetSelection: ChildFactory<WarlordController>) {
    this.createTargetSelection = createTargetSelection;
  }

  public update(beliefs: WarlordBeliefs, updateChild: WarlordUpdateChild) {
    if (this.interval.claim(beliefs.common.time)) {
      this.targetSelection ??= this.createTargetSelection().value;
      updateChild(this.targetSelection);
    }
  }
}

export function provideOperateTowersIntention(): ProvidedComponent<WarlordIntention> {
  const children: ProvidedChildren = [];

  return {
    value: new OperateTowersIntention(
      childFactory(children, provideTowerTargetSelectionController)
    ),
    children,
  };
}
