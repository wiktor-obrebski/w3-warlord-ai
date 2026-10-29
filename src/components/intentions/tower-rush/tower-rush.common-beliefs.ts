import type { Point } from '@lib/math';
import type { UnitId } from '../../../contracts/ids';
import type {
  GoldMine,
  HomeDestructable,
  OwnUnit,
} from '../../../contracts/world';

export { type TowerRushCommonBeliefs };

/**
 * What the tower rush, its Plan and its Controllers need to know from the
 * Common Beliefs.
 */
interface TowerRushCommonBeliefs {
  readonly time: number;
  readonly ownStartPosition: Point;
  readonly enemyStartPosition?: Point;

  readonly ownUnits: ReadonlyMap<UnitId, OwnUnit>;
  readonly townHall?: UnitId;
  readonly peasants: readonly UnitId[];
  readonly militia: readonly UnitId[];
  readonly idleUnits: readonly UnitId[];
  readonly harvestingUnits: readonly UnitId[];
  readonly holdingPositionUnits: readonly UnitId[];
  readonly repairingUnits: readonly UnitId[];
  readonly scoutTowerBuildOrderUnits: readonly UnitId[];
  readonly scoutTowers: readonly UnitId[];
  readonly guardTowers: readonly UnitId[];
  readonly lumberMills: readonly UnitId[];
  readonly buildingsUnderConstruction: readonly UnitId[];
  readonly buildingsUpgrading: readonly UnitId[];

  readonly gold: number;
  readonly lumber: number;
  readonly homeGoldMine?: GoldMine;
  readonly enemyMainGoldMine?: GoldMine;
  readonly destructablesNearHomeByDistance: readonly HomeDestructable[];
}
