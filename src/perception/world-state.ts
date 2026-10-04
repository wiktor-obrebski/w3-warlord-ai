import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3DestructableApi from "@lib/warcraft3-api/destructable";
import { Point } from "@lib/math";

// The handle is only for targeting orders; reasoning reads the observed
// properties, which perception collects only while the unit is visible.
export interface VisibleEnemy {
  unit: W3UnitApi.unit;
  position: Point;
  life: number;
  isMelee: boolean;
  isRanged: boolean;
  isSiege: boolean;
  isStructure: boolean;
  isWorker: boolean;
  // A Night Elf Ancient walking and fighting like a unit.
  isUprootedAncient: boolean;
  // The bot's unit it was recently seen starting an attack on.
  attackTarget?: W3UnitApi.unit;
}

export interface WorldState {
  // Game seconds since the bot started playing.
  time: number;
  ownStartPosition: Point;
  enemyStartPosition?: Point;
  // Enemy players still in the game; a defeated player is no longer counted.
  enemyPlayersPlaying: number;

  townHall?: W3UnitApi.unit;
  peasants: W3UnitApi.unit[];
  militia: W3UnitApi.unit[];
  idleUnits: W3UnitApi.unit[];
  harvestingUnits: W3UnitApi.unit[];
  holdingPositionUnits: W3UnitApi.unit[];
  repairingUnits: W3UnitApi.unit[];
  // Units whose current order is to build a Scout Tower.
  scoutTowerBuildOrderUnits: W3UnitApi.unit[];
  // Includes towers still under construction.
  scoutTowers: W3UnitApi.unit[];
  guardTowers: W3UnitApi.unit[];
  // Includes Lumber Mills still under construction.
  lumberMills: W3UnitApi.unit[];
  buildingsUnderConstruction: W3UnitApi.unit[];
  buildingsUpgrading: W3UnitApi.unit[];

  visibleEnemies: VisibleEnemy[];

  gold: number;
  lumber: number;
  homeGoldMine?: W3UnitApi.unit;
  enemyMainGoldMine?: W3UnitApi.unit;
  destructablesNearHomeByDistance: W3DestructableApi.destructable[];
}
