import { ChildFactory, ChildHandle, childFactory } from '@lib/bdi';
import type { ActorControl } from '../../../contracts/actor-control';
import type {
  AssembledChildren,
  AssembledWarlordComponent,
  WarlordBeliefs,
  WarlordController,
  WarlordIntention,
  WarlordUpdateChild,
} from '../../../contracts/component';
import type { WarlordDesire } from '../../../contracts/desires';
import { UpdateInterval } from '../update-interval';
import type { TowerRushCommonBeliefs } from './tower-rush.common-beliefs';
import { createTowerRushState } from './tower-rush.state';
import {
  EstablishTowerPositionPlan,
  assembleEstablishTowerPositionPlan,
} from './establish-tower-position/establish-tower-position.plan';
import { assembleTowerRushEconomyController } from './tower-rush-economy.ctrl';
import { assembleTowerMaintenanceController } from './tower-maintenance.ctrl';

export {
  type TowerRushIntention,
  type TowerRushCapabilities,
  assembleTowerRushIntention,
};

interface TowerRushCapabilities {
  readonly actorControl: ActorControl;
}

interface TowerRushIntention<
  TCommonBeliefs extends TowerRushCommonBeliefs = TowerRushCommonBeliefs,
> extends WarlordIntention<TCommonBeliefs> {
  /** Whether every rush tower stands as a Guard Tower. */
  readonly positionEstablished: boolean;
}

interface AssembleTowerRushIntentionArgs {
  capabilities: TowerRushCapabilities;
}

/**
 * Assembles the tower rush for a bot whose Common Beliefs are
 * `TCommonBeliefs`, which must provide what the tower rush needs to know.
 */
function assembleTowerRushIntention<
  TCommonBeliefs extends TowerRushCommonBeliefs,
>({
  capabilities,
}: AssembleTowerRushIntentionArgs): AssembledWarlordComponent<
  TowerRushIntention<TCommonBeliefs>,
  TCommonBeliefs
> {
  const rush = createTowerRushState();
  const children: AssembledChildren<TCommonBeliefs> = [];

  return {
    component: new TowerRush({
      factories: {
        createEstablishTowerPositionPlan: childFactory({
          children,
          assemble: () =>
            assembleEstablishTowerPositionPlan({
              rush,
              capabilities: { actorControl: capabilities.actorControl },
            }),
        }),
        createEconomyController: childFactory({
          children,
          assemble: () =>
            assembleTowerRushEconomyController({
              rush,
              capabilities: { actorControl: capabilities.actorControl },
            }),
        }),
        createTowerMaintenanceController: childFactory({
          children,
          assemble: () =>
            assembleTowerMaintenanceController({
              rush,
              capabilities: { actorControl: capabilities.actorControl },
            }),
        }),
      },
    }),
    children,
  };
}

const UpdateSeconds = 1;

type TowerRushController = WarlordController<TowerRushCommonBeliefs>;

interface TowerRushChildFactories {
  readonly createEstablishTowerPositionPlan: ChildFactory<EstablishTowerPositionPlan>;
  readonly createEconomyController: ChildFactory<TowerRushController>;
  readonly createTowerMaintenanceController: ChildFactory<TowerRushController>;
}

interface TowerRushUpdateArgs {
  beliefs: WarlordBeliefs<TowerRushCommonBeliefs>;
  updateChild: WarlordUpdateChild<TowerRushCommonBeliefs>;
}

interface TowerRushDiscardEndedPlanArgs {
  plan: ChildHandle<EstablishTowerPositionPlan>;
}

/**
 * Commitment to a Human tower rush: Guard Towers established next to the
 * enemy main, funded by a home economy and kept repaired by the forward
 * workers.
 */
class TowerRush implements TowerRushIntention {
  private readonly interval = new UpdateInterval({ seconds: UpdateSeconds });
  private readonly factories: TowerRushChildFactories;
  private plan: ChildHandle<EstablishTowerPositionPlan> | null = null;
  private economy: TowerRushController | null = null;
  private towerMaintenance: TowerRushController | null = null;
  private established = false;
  private updatedBefore = false;

  public constructor({ factories }: { factories: TowerRushChildFactories }) {
    this.factories = factories;
  }

  public get positionEstablished(): boolean {
    return this.established;
  }

  /**
   * The plan starts on the first update. Its first update assigns the
   * workers the economy manages and issues orders that tick's beliefs
   * predate, so the economy starts from the next update on. Maintenance
   * relies on a tower's life fraction reflecting damage, not build progress,
   * so it starts once the towers are built. The plan is discarded once it
   * has ended.
   *
   * Children are updated plan first: Actors it stops requesting, such as the
   * starting workers or the forward Peasants once the towers stand, are
   * released when its update ends, so the economy and maintenance take them
   * over in the same update.
   */
  public update({ beliefs, updateChild }: TowerRushUpdateArgs) {
    if (!this.interval.claim({ now: beliefs.commonBeliefs.time })) {
      return;
    }

    if (!this.updatedBefore) {
      this.plan = this.factories.createEstablishTowerPositionPlan();
    } else {
      this.economy ??= this.factories.createEconomyController().component;
    }

    if (this.plan?.component.towersBuilt) {
      this.towerMaintenance ??=
        this.factories.createTowerMaintenanceController().component;
    }

    if (this.plan) {
      updateChild({ child: this.plan.component });
      this.discardEndedPlan({ plan: this.plan });
    }

    if (this.economy) {
      updateChild({ child: this.economy });
    }

    if (this.towerMaintenance) {
      updateChild({ child: this.towerMaintenance });
    }

    this.updatedBefore = true;
  }

  public assessCommitment({ desire }: { desire: WarlordDesire | null }) {
    return desire !== null;
  }

  private discardEndedPlan({ plan }: TowerRushDiscardEndedPlanArgs) {
    const { status } = plan.component;

    if (status === 'running') {
      return;
    }

    if (status === 'failed') {
      throw new Error('Tower rush: establishing the tower position failed.');
    }

    plan.discard();
    this.plan = null;
    this.established = true;
  }
}
