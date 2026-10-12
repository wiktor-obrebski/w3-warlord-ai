import type * as W3UnitApi from '@lib/warcraft3-api/unit';
import type { Point } from '@lib/math';
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

  readonly ownUnits: ReadonlyMap<W3UnitApi.unit, OwnUnit>;
  readonly townHall?: W3UnitApi.unit;
  readonly peasants: readonly W3UnitApi.unit[];
  readonly militia: readonly W3UnitApi.unit[];
  readonly idleUnits: readonly W3UnitApi.unit[];
  readonly harvestingUnits: readonly W3UnitApi.unit[];
  readonly holdingPositionUnits: readonly W3UnitApi.unit[];
  readonly repairingUnits: readonly W3UnitApi.unit[];
  readonly scoutTowerBuildOrderUnits: readonly W3UnitApi.unit[];
  readonly scoutTowers: readonly W3UnitApi.unit[];
  readonly guardTowers: readonly W3UnitApi.unit[];
  readonly lumberMills: readonly W3UnitApi.unit[];
  readonly buildingsUnderConstruction: readonly W3UnitApi.unit[];
  readonly buildingsUpgrading: readonly W3UnitApi.unit[];

  readonly gold: number;
  readonly lumber: number;
  readonly homeGoldMine?: GoldMine;
  readonly enemyMainGoldMine?: GoldMine;
  readonly destructablesNearHomeByDistance: readonly HomeDestructable[];
}
