import type { ActorControl } from '../../../contracts/actor-control';
import type { UnitId } from '../../../contracts/ids';
import type { WarcraftProbes } from '../../../contracts/probes';
import type { DecisionRecorder } from '../../../contracts/record';
import type {
  AssembledWarlordComponent,
  WarlordBeliefs,
  WarlordController,
} from '../../../contracts/component';
import type { OperateTowersCommonBeliefs } from './operate-towers.common-beliefs';
import {
  RankedTarget,
  rankTowerTargets,
  TARGET_PRIORITY,
} from './operate-towers.assessments';

export { assembleTowerTargetSelectionController };

interface AssembleTowerTargetSelectionControllerArgs {
  capabilities: TowerTargetSelectionControllerCapabilities;
}

function assembleTowerTargetSelectionController({
  capabilities,
}: AssembleTowerTargetSelectionControllerArgs): AssembledWarlordComponent<
  WarlordController<OperateTowersCommonBeliefs>,
  OperateTowersCommonBeliefs
> {
  return {
    component: new TowerTargetSelectionController({ capabilities }),
    children: [],
  };
}

// Not verified in-game that IsUnitInRange matches the tower's own reach.
const GuardTowerAttackRange = 700;

interface TowerTarget {
  tower: UnitId;
  attackTarget: UnitId;
}

interface TowerTargetSelectionControllerCapabilities {
  readonly actorControl: ActorControl;
  readonly probes: WarcraftProbes;
  readonly recorder: DecisionRecorder;
}

interface TowerTargetSelectionControllerConstructorArgs {
  capabilities: TowerTargetSelectionControllerCapabilities;
}

interface TowerTargetSelectionControllerUpdateArgs {
  beliefs: WarlordBeliefs<OperateTowersCommonBeliefs>;
}

interface TowerTargetSelectionControllerAttackBestTargetInRangeArgs {
  tower: UnitId;
  rankedTargets: readonly RankedTarget[];
  beliefs: Readonly<OperateTowersCommonBeliefs>;
}

interface TowerTargetSelectionControllerRememberTowerTargetArgs {
  tower: UnitId;
  attackTarget: UnitId;
}

/**
 * Targets are ranked once for all Guard Towers; each tower then attacks the
 * best one within its own range, so overlapping towers focus the same target.
 */
class TowerTargetSelectionController implements WarlordController<OperateTowersCommonBeliefs> {
  private readonly capabilities: TowerTargetSelectionControllerCapabilities;
  // The last attack order of each Guard Tower, so it is not re-issued while
  // the tower is still carrying it out.
  private towerTargets: TowerTarget[] = [];

  public constructor({
    capabilities,
  }: TowerTargetSelectionControllerConstructorArgs) {
    this.capabilities = capabilities;
  }

  public update({
    beliefs: { commonBeliefs: beliefs },
  }: TowerTargetSelectionControllerUpdateArgs) {
    const rankedTargets = rankTowerTargets({ beliefs });

    this.towerTargets = this.towerTargets.filter((towerTarget) =>
      beliefs.guardTowers.includes(towerTarget.tower)
    );

    for (const tower of beliefs.guardTowers) {
      if (
        this.capabilities.actorControl.request({
          actor: tower,
          request: 'normal',
        })
      ) {
        this.attackBestTargetInRange({ tower, rankedTargets, beliefs });
      }
    }
  }

  // Re-issuing an attack the tower is already carrying out could restart its
  // attack, so the order is only issued when the target changes or the tower
  // has dropped it. A rejected target is skipped in favour of the next one.
  private attackBestTargetInRange({
    tower,
    rankedTargets,
    beliefs,
  }: TowerTargetSelectionControllerAttackBestTargetInRangeArgs) {
    const { probes } = this.capabilities;
    const currentAttackTarget = this.towerTargets.find(
      (towerTarget) => towerTarget.tower === tower
    )?.attackTarget;
    const towerBusy = !beliefs.idleUnits.includes(tower);

    for (const { enemy, priority } of rankedTargets) {
      if (
        !probes.isInRange({
          unit: tower,
          target: enemy.unit,
          range: GuardTowerAttackRange,
        })
      ) {
        continue;
      }

      if (enemy.unit === currentAttackTarget && towerBusy) {
        return;
      }

      if (probes.tryAttack({ unit: tower, target: enemy.unit })) {
        this.rememberTowerTarget({ tower, attackTarget: enemy.unit });
        this.capabilities.recorder.note({
          message: `Operate towers: Guard Tower attacks ${TARGET_PRIORITY[priority]} target with ${Math.floor(enemy.life)} life.`,
        });
        return;
      }
    }

    this.forgetTowerTarget({ tower });
  }

  private rememberTowerTarget({
    tower,
    attackTarget,
  }: TowerTargetSelectionControllerRememberTowerTargetArgs) {
    this.forgetTowerTarget({ tower });
    this.towerTargets.push({ tower, attackTarget });
  }

  private forgetTowerTarget({ tower }: { tower: UnitId }) {
    this.towerTargets = this.towerTargets.filter(
      (towerTarget) => towerTarget.tower !== tower
    );
  }
}
