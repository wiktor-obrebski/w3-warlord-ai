import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3GroupApi from "@lib/warcraft3-api/group";
import * as W3LocationApi from "@lib/warcraft3-api/location";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import * as W3NeutralApi from "@lib/warcraft3-api/neutral";
import { Point, WorldState } from "./world-state";

type UnitGroup = ReturnType<typeof W3GroupApi.CreateGroup>;

const HOME_GOLD_MINE_SEARCH_RADIUS = 1500;

export function perceiveWorld(bot: W3PlayerApi.player): WorldState {
  const ownStartPosition = startPositionOf(bot);
  const enemy = findEnemyPlayer(bot);

  const world: WorldState = {
    ownStartPosition,
    enemyStartPosition: enemy && startPositionOf(enemy),
    peasants: [],
    militia: [],
    homeGoldMine: findClosestGoldMine(ownStartPosition),
  };

  for (const unit of unitsOfPlayer(bot)) {
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

    const dx = W3UnitApi.GetUnitX(unit) - position.x;
    const dy = W3UnitApi.GetUnitY(unit) - position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < closestDistance) {
      closest = unit;
      closestDistance = distance;
    }
  }

  return closest;
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
