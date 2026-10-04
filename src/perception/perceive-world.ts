import * as W3PlayerApi from "@lib/warcraft3-api/player";
import * as W3UnitApi from "@lib/warcraft3-api/unit";
import * as W3GroupApi from "@lib/warcraft3-api/group";
import * as W3LocationApi from "@lib/warcraft3-api/location";
import * as W3HumanApi from "@lib/warcraft3-api/human";
import * as W3NeutralApi from "@lib/warcraft3-api/neutral";
import * as W3NightElfApi from "@lib/warcraft3-api/nightelf";
import * as W3UndeadApi from "@lib/warcraft3-api/undead";
import * as W3RectApi from "@lib/warcraft3-api/rect";
import * as W3DestructableApi from "@lib/warcraft3-api/destructable";
import * as W3OrcApi from "@lib/warcraft3-api/orc";
import { Point, VisibleEnemy, WorldState } from "./world-state";
import { AttackObserver, recentAttackTarget } from "./attack-observer";
import { GameClock, readGameClock } from "./game-clock";

type UnitGroup = ReturnType<typeof W3GroupApi.CreateGroup>;

const MAIN_GOLD_MINE_SEARCH_RADIUS = 1500;
const HOME_DESTRUCTABLE_SEARCH_RADIUS = 1500;
// Night Elf and Undead melee starts replace their main mine with an
// entangled or haunted one and hide the original, which range enumeration
// then skips.
const GOLD_MINE_TYPES: number[] = [
  W3NeutralApi.Building.GOLD_MINE,
  W3NightElfApi.Building.ENTANGLED_GOLD_MINE,
  W3UndeadApi.Building.HAUNTED_GOLD_MINE,
];
// Warcraft has no siege classification for units; these are the units whose
// attack type is siege.
const SIEGE_UNIT_TYPES: number[] = [
  W3HumanApi.Unit.MORTAR_TEAM,
  W3HumanApi.Unit.SIEGE_ENGINE,
  W3HumanApi.Unit.SIEGE_ENGINE_WITH_BARRAGE,
  W3OrcApi.Unit.DEMOLISHER,
  W3NightElfApi.Unit.GLAIVE_THROWER,
  W3UndeadApi.Unit.MEAT_WAGON,
];
const NO_ORDER = 0;
const HARVEST_ORDER_STRINGS = ["harvest", "resumeharvesting", "returnresources"];
// Warcraft treats units at or below this life as dead.
const DEAD_UNIT_LIFE = 0.405;

export function perceiveWorld(
  bot: W3PlayerApi.player,
  clock: GameClock,
  attackObserver: AttackObserver,
): WorldState {
  const ownStartPosition = startPositionOf(bot);
  const enemies = enemyPlayers(bot);
  const enemy = enemies[0];
  const enemyStartPosition = enemy && startPositionOf(enemy);

  const world: WorldState = {
    time: readGameClock(clock),
    ownStartPosition,
    enemyStartPosition,
    peasants: [],
    militia: [],
    idleUnits: [],
    harvestingUnits: [],
    holdingPositionUnits: [],
    repairingUnits: [],
    scoutTowers: [],
    guardTowers: [],
    lumberMills: [],
    buildingsUnderConstruction: [],
    buildingsUpgrading: [],
    visibleEnemies: visibleEnemies(bot, enemies, attackObserver),
    gold: W3PlayerApi.GetPlayerState(bot, W3PlayerApi.PLAYER_STATE_RESOURCE_GOLD),
    lumber: W3PlayerApi.GetPlayerState(
      bot,
      W3PlayerApi.PLAYER_STATE_RESOURCE_LUMBER,
    ),
    homeGoldMine: findClosestGoldMine(ownStartPosition),
    // Gold mine placement is static map knowledge, visible to any player
    // before scouting, so reading it under fog is fair.
    enemyMainGoldMine:
      enemyStartPosition && findClosestGoldMine(enemyStartPosition),
    destructablesNearHomeByDistance: destructablesByDistance(
      ownStartPosition,
      HOME_DESTRUCTABLE_SEARCH_RADIUS,
    ),
  };

  // Looked up per call because OrderId returns 0 during map init.
  const harvestOrders = HARVEST_ORDER_STRINGS.map((order) =>
    W3UnitApi.OrderId(order),
  );
  const holdPositionOrder = W3UnitApi.OrderId("holdposition");
  // Assumed, not verified in-game, to stay the current order while repairing.
  const repairOrder = W3UnitApi.OrderId("repair");

  for (const unit of unitsOfPlayer(bot)) {
    if (!isUnitAlive(unit)) {
      continue;
    }

    const order = W3UnitApi.GetUnitCurrentOrder(unit);

    if (order === NO_ORDER) {
      world.idleUnits.push(unit);
    } else if (harvestOrders.includes(order)) {
      world.harvestingUnits.push(unit);
    } else if (order === holdPositionOrder) {
      world.holdingPositionUnits.push(unit);
    } else if (order === repairOrder) {
      world.repairingUnits.push(unit);
    }

    const typeId = W3UnitApi.GetUnitTypeId(unit);

    if (typeId === W3HumanApi.Unit.PEASANT) {
      world.peasants.push(unit);
    } else if (typeId === W3HumanApi.Unit.MILITIA) {
      world.militia.push(unit);
    } else if (typeId === W3HumanApi.Building.TOWN_HALL) {
      world.townHall = unit;
    } else if (typeId === W3HumanApi.Building.SCOUT_TOWER) {
      world.scoutTowers.push(unit);
    } else if (typeId === W3HumanApi.Building.GUARD_TOWER) {
      world.guardTowers.push(unit);
    } else if (typeId === W3HumanApi.Building.LUMBER_MILL) {
      world.lumberMills.push(unit);
    }

    // An upgrading building also has the under-construction ability.
    if (
      W3UnitApi.GetUnitAbilityLevel(unit, W3UnitApi.Ability.BUILDING_UPGRADING) >
      0
    ) {
      world.buildingsUpgrading.push(unit);
    } else if (
      W3UnitApi.GetUnitAbilityLevel(
        unit,
        W3UnitApi.Ability.BUILDING_UNDER_CONSTRUCTION,
      ) > 0
    ) {
      world.buildingsUnderConstruction.push(unit);
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

function enemyPlayers(bot: W3PlayerApi.player): W3PlayerApi.player[] {
  const enemies: W3PlayerApi.player[] = [];

  for (let id = 0; id < W3PlayerApi.bj_MAX_PLAYERS; id++) {
    const candidate = W3PlayerApi.Player(id);

    if (
      candidate &&
      W3PlayerApi.GetPlayerSlotState(candidate) ===
      W3PlayerApi.PLAYER_SLOT_STATE_PLAYING &&
      W3PlayerApi.IsPlayerEnemy(bot, candidate)
    ) {
      enemies.push(candidate);
    }
  }

  return enemies;
}

function visibleEnemies(
  bot: W3PlayerApi.player,
  enemies: W3PlayerApi.player[],
  attackObserver: AttackObserver,
): VisibleEnemy[] {
  const visible: VisibleEnemy[] = [];

  for (const enemy of enemies) {
    for (const unit of unitsOfPlayer(enemy)) {
      if (!isUnitAlive(unit) || !W3UnitApi.IsUnitVisible(unit, bot)) {
        continue;
      }

      visible.push({
        unit,
        life: W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE),
        isMelee: W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_MELEE_ATTACKER),
        isRanged: W3UnitApi.IsUnitType(
          unit,
          W3UnitApi.UNIT_TYPE_RANGED_ATTACKER,
        ),
        isSiege: SIEGE_UNIT_TYPES.includes(W3UnitApi.GetUnitTypeId(unit)),
        isStructure: W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_STRUCTURE),
        isWorker: W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_PEON),
        attackTarget: recentAttackTarget(attackObserver, unit),
      });
    }
  }

  return visible;
}

function findClosestGoldMine(position: Point): W3UnitApi.unit | undefined {
  let closest: W3UnitApi.unit | undefined;
  let closestDistance = Infinity;

  for (const unit of unitsInRange(position, MAIN_GOLD_MINE_SEARCH_RADIUS)) {
    if (!GOLD_MINE_TYPES.includes(W3UnitApi.GetUnitTypeId(unit))) {
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
