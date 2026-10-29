import type { Point } from '@lib/math';
import type { UnitId } from './ids';
import type { OrderTicket } from './orders';
import type {
  GoldMine,
  HomeDestructable,
  ObservedAttack,
  OwnUnit,
  Race,
  StartLocation,
  VisibleEnemy,
} from './world';

export {
  type Observations,
  type ObservedWorld,
  type ObservedSelf,
  type ObservedEnemy,
};

/** What Perception reports each tick: all the mind learns about the game. */
interface Observations {
  readonly world: ObservedWorld;
  // Attacks on the bot's units started since the previous tick, oldest first.
  readonly attacksStarted: readonly ObservedAttack[];
  // The orders of the previous step that Warcraft refused.
  readonly refusedOrders: readonly OrderTicket[];
}

interface ObservedWorld {
  // Game seconds since the bot started playing.
  readonly time: number;
  // Every start location of the map but the bot's own; which of them the
  // enemies started at is not observed.
  readonly otherStartLocations: readonly StartLocation[];
  readonly self: ObservedSelf;
  readonly enemy: ObservedEnemy;
}

/** The bot's own player, its units, and its home. */
interface ObservedSelf {
  readonly race: Race;
  readonly startPosition: Point;

  // Every living unit of the bot, including buildings.
  readonly units: ReadonlyMap<UnitId, OwnUnit>;
  // Living units with the worker classification.
  readonly workers: readonly OwnUnit[];
  readonly townHall?: UnitId;
  readonly peasants: readonly UnitId[];
  readonly militia: readonly UnitId[];
  readonly idleUnits: readonly UnitId[];
  readonly harvestingUnits: readonly UnitId[];
  readonly holdingPositionUnits: readonly UnitId[];
  readonly repairingUnits: readonly UnitId[];
  // Units whose current order is to build a Scout Tower.
  readonly scoutTowerBuildOrderUnits: readonly UnitId[];
  // Includes towers still under construction.
  readonly scoutTowers: readonly UnitId[];
  readonly guardTowers: readonly UnitId[];
  // Includes Lumber Mills still under construction.
  readonly lumberMills: readonly UnitId[];
  readonly buildingsUnderConstruction: readonly UnitId[];
  readonly buildingsUpgrading: readonly UnitId[];

  readonly gold: number;
  readonly lumber: number;
  readonly homeGoldMine?: GoldMine;
  readonly destructablesNearHomeByDistance: readonly HomeDestructable[];
}

interface ObservedEnemy {
  // Enemy players still in the game; a defeated player is no longer counted.
  readonly playersPlaying: number;
  readonly visibleUnits: readonly VisibleEnemy[];
}
