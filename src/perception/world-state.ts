import * as W3UnitApi from "@lib/warcraft3-api/unit";

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

  homeGoldMine?: W3UnitApi.unit;
}
