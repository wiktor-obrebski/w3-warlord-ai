import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3GroupApi from "@lib/warcraft3-api/group";
import * as W3LocationApi from "@lib/warcraft3-api/location";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import * as W3NeutralApi from "@lib/warcraft3-api/neutral";
import * as W3RectApi from "@lib/warcraft3-api/rect";
import * as W3DestructableApi from "@lib/warcraft3-api/destructable";
import { Point, WorldState } from "./world-state";

type UnitGroup = ReturnType<typeof W3GroupApi.CreateGroup>;

const HOME_GOLD_MINE_SEARCH_RADIUS = 1500;
const HOME_DESTRUCTABLE_SEARCH_RADIUS = 1500;
const NO_ORDER = 0;
// Warcraft treats units at or below this life as dead.
const DEAD_UNIT_LIFE = 0.405;

export function perceiveWorld(bot: W3PlayerApi.player): WorldState {
  const ownStartPosition = startPositionOf(bot);
  const enemy = findEnemyPlayer(bot);

  const world: WorldState = {
    ownStartPosition,
    enemyStartPosition: enemy && startPositionOf(enemy),
    peasants: [],
    militia: [],
    idleUnits: [],
    gold: W3PlayerApi.GetPlayerState(bot, W3PlayerApi.PLAYER_STATE_RESOURCE_GOLD),
    homeGoldMine: findClosestGoldMine(ownStartPosition),
    destructablesNearHomeByDistance: destructablesByDistance(
      ownStartPosition,
      HOME_DESTRUCTABLE_SEARCH_RADIUS,
    ),
  };

  for (const unit of unitsOfPlayer(bot)) {
    if (!isUnitAlive(unit)) {
      continue;
    }

    if (W3UnitApi.GetUnitCurrentOrder(unit) === NO_ORDER) {
      world.idleUnits.push(unit);
    }

    const typeId = W3UnitApi.GetUnitTypeId(unit);

    if (typeId === W3HumanApi.Unit.PEASANT) {
      world.peasants.push(unit);
    } else if (typeId === W3HumanApi.Unit.MILITIA) {
      world.militia.push(unit);
    } else if (typeId === W3HumanApi.Building.TOWN_HALL) {
      world.townHall = unit;
    }
  }

  return world;
}

function isUnitAlive(unit: W3UnitApi.unit): boolean {
  return (
    W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE) > DEAD_UNIT_LIFE
  );
}

function isDestructableAlive(
  destructable: W3DestructableApi.destructable,
): boolean {
  return W3DestructableApi.GetDestructableLife(destructable) > 0;
}

function startPositionOf(whichPlayer: W3PlayerApi.player): Point {
  const startLocation = W3PlayerApi.GetPlayerStartLocation(whichPlayer);

  return {
    x: W3LocationApi.GetStartLocationX(startLocation),
    y: W3LocationApi.GetStartLocationY(startLocation),
  };
}

function findEnemyPlayer(
  bot: W3PlayerApi.player,
): W3PlayerApi.player | undefined {
  for (let id = 0; id < W3PlayerApi.bj_MAX_PLAYERS; id++) {
    const candidate = W3PlayerApi.Player(id);

    if (
      candidate &&
      W3PlayerApi.GetPlayerSlotState(candidate) ===
        W3PlayerApi.PLAYER_SLOT_STATE_PLAYING &&
      W3PlayerApi.IsPlayerEnemy(bot, candidate)
    ) {
      return candidate;
    }
  }

  return undefined;
}

function findClosestGoldMine(position: Point): W3UnitApi.unit | undefined {
  let closest: W3UnitApi.unit | undefined;
  let closestDistance = Infinity;

  for (const unit of unitsInRange(position, HOME_GOLD_MINE_SEARCH_RADIUS)) {
    if (W3UnitApi.GetUnitTypeId(unit) !== W3NeutralApi.Building.GOLD_MINE) {
      continue;
    }

    const distance = distanceBetween(position, {
      x: W3UnitApi.GetUnitX(unit),
      y: W3UnitApi.GetUnitY(unit),
    });

    if (distance < closestDistance) {
      closest = unit;
      closestDistance = distance;
    }
  }

  return closest;
}

function destructablesByDistance(
  position: Point,
  radius: number,
): W3DestructableApi.destructable[] {
  const area = W3RectApi.Rect(
    position.x - radius,
    position.y - radius,
    position.x + radius,
    position.y + radius,
  );
  const found: {
    destructable: W3DestructableApi.destructable;
    distance: number;
  }[] = [];

  W3DestructableApi.EnumDestructablesInRect(area, undefined, () => {
    const destructable = W3DestructableApi.GetEnumDestructable();

    if (destructable && isDestructableAlive(destructable)) {
      found.push({
        destructable,
        distance: distanceBetween(position, {
          x: W3DestructableApi.GetDestructableX(destructable),
          y: W3DestructableApi.GetDestructableY(destructable),
        }),
      });
    }
  });
  W3RectApi.RemoveRect(area);

  found.sort((a, b) => a.distance - b.distance);

  return found.map((entry) => entry.destructable);
}

function distanceBetween(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function unitsOfPlayer(whichPlayer: W3PlayerApi.player): W3UnitApi.unit[] {
  const group = W3GroupApi.CreateGroup();
  W3GroupApi.GroupEnumUnitsOfPlayer(group, whichPlayer, null);
  return drainGroup(group);
}

function unitsInRange(position: Point, radius: number): W3UnitApi.unit[] {
  const group = W3GroupApi.CreateGroup();

  W3GroupApi.GroupEnumUnitsInRange(group, position.x, position.y, radius, null);
  return drainGroup(group);
}

function drainGroup(whichGroup: UnitGroup): W3UnitApi.unit[] {
  const units: W3UnitApi.unit[] = [];

  while (true) {
    const unit = W3GroupApi.FirstOfGroup(whichGroup);

    if (!unit) {
      break;
    }

    W3GroupApi.GroupRemoveUnit(whichGroup, unit);
    units.push(unit);
  }

  W3GroupApi.DestroyGroup(whichGroup);

  return units;
}
