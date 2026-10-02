import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3DestructableApi from "@lib/warcraft3-api/destructable";

export interface Point {
  x: number;
  y: number;
}

export interface WorldState {
  ownStartPosition: Point;
  enemyStartPosition?: Point;

  townHall?: W3UnitApi.unit;
  peasants: W3UnitApi.unit[];
  militia: W3UnitApi.unit[];
  idleUnits: W3UnitApi.unit[];

  gold: number;
  homeGoldMine?: W3UnitApi.unit;
  enemyMainGoldMine?: W3UnitApi.unit;
  destructablesNearHomeByDistance: W3DestructableApi.destructable[];
}
