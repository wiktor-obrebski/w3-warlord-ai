import * as W3UnitApi from "@lib/warcraft3-api/unit";
import { debug } from "../../debug";
import { ActorControl, NORMAL_REQUEST } from "../../actor";
import {
  ProvidedComponent,
  WarlordBeliefs,
  WarlordController,
} from "../../execution";
import { CommonBeliefs } from "../../beliefs/common.beliefs";
import {
  RankedTarget,
  rankTowerTargets,
  TargetPriority,
} from "./operate-towers.assessments";

// Not verified in-game that IsUnitInRange matches the tower's own reach.
const GUARD_TOWER_ATTACK_RANGE = 700;

interface TowerTarget {
  tower: W3UnitApi.unit;
  target: W3UnitApi.unit;
}

/**
 * Targets are ranked once for all Guard Towers; each tower then attacks the
 * best one within its own range, so overlapping towers focus the same target.
 */
class TowerTargetSelectionController implements WarlordController {
  // The last attack order of each Guard Tower, so it is not re-issued while
  // the tower is still carrying it out.
  private towerTargets: TowerTarget[] = [];

  public update({ common: beliefs }: WarlordBeliefs, control: ActorControl) {
    const rankedTargets = rankTowerTargets(beliefs);

    this.towerTargets = this.towerTargets.filter((entry) =>
      beliefs.guardTowers.includes(entry.tower),
    );

    for (const tower of beliefs.guardTowers) {
      if (control.request(tower, NORMAL_REQUEST)) {
        this.attackBestTargetInRange(tower, rankedTargets, beliefs);
      }
    }
  }

  // Re-issuing an attack the tower is already carrying out could restart its
  // attack, so the order is only issued when the target changes or the tower
  // has dropped it. A rejected target is skipped in favour of the next one.
  private attackBestTargetInRange(
    tower: W3UnitApi.unit,
    rankedTargets: readonly RankedTarget[],
    beliefs: Readonly<CommonBeliefs>,
  ) {
    const currentTarget = this.towerTargets.find(
      (entry) => entry.tower === tower,
    )?.target;
    const towerBusy = !beliefs.idleUnits.includes(tower);

    for (const { enemy, priority } of rankedTargets) {
      if (
        !W3UnitApi.IsUnitInRange(tower, enemy.unit, GUARD_TOWER_ATTACK_RANGE)
      ) {
        continue;
      }

      if (enemy.unit === currentTarget && towerBusy) {
        return;
      }

      if (W3UnitApi.IssueTargetOrder(tower, "attack", enemy.unit)) {
        this.rememberTowerTarget(tower, enemy.unit);
        debug(
          `Operate towers: Guard Tower attacks ${TargetPriority[priority]} target with ${Math.floor(enemy.life)} life.`,
        );
        return;
      }
    }

    this.forgetTowerTarget(tower);
  }

  private rememberTowerTarget(tower: W3UnitApi.unit, target: W3UnitApi.unit) {
    this.forgetTowerTarget(tower);
    this.towerTargets.push({ tower, target });
  }

  private forgetTowerTarget(tower: W3UnitApi.unit) {
    this.towerTargets = this.towerTargets.filter(
      (entry) => entry.tower !== tower,
    );
  }
}

export function provideTowerTargetSelectionController(): ProvidedComponent<WarlordController> {
  return { value: new TowerTargetSelectionController(), children: [] };
}
