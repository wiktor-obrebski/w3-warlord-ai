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
import { BeliefModel } from "@lib/bdi";
import { Point, Vector } from "@lib/math";
import {
  AttackObserver,
  isRecentlyAttacked,
  observeAttacksOn,
  recentAttackTarget,
} from "./attack-observer";
import { GameClock, readGameClock, startGameClock } from "./game-clock";

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
// Assumed, not verified in-game: a build order's id is the rawcode of the
// building, as with IssueBuildOrderById.
const SCOUT_TOWER_BUILD_ORDER: number = W3HumanApi.Building.SCOUT_TOWER;
const HARVEST_ORDER_STRINGS = ["harvest", "resumeharvesting", "returnresources"];
// Warcraft treats units at or below this life as dead.
const DEAD_UNIT_LIFE = 0.405;

export interface OwnUnit {
  readonly unit: W3UnitApi.unit;
  readonly position: Point;
  readonly life: number;
  readonly maxLife: number;
  readonly isIdle: boolean;
  // Recently seen being attacked.
  readonly isAttacked: boolean;
}

// The handle is only for targeting orders; reasoning reads the observed
// properties, which are collected only while the unit is visible.
export interface VisibleEnemy {
  readonly unit: W3UnitApi.unit;
  readonly position: Point;
  readonly life: number;
  readonly isMelee: boolean;
  readonly isRanged: boolean;
  readonly isSiege: boolean;
  readonly isStructure: boolean;
  readonly isWorker: boolean;
  // A Night Elf Ancient walking and fighting like a unit.
  readonly isUprootedAncient: boolean;
  // The bot's unit it was recently seen starting an attack on.
  readonly attackTarget?: W3UnitApi.unit;
}

export interface GoldMine {
  readonly unit: W3UnitApi.unit;
  readonly position: Point;
}

export interface HomeDestructable {
  readonly destructable: W3DestructableApi.destructable;
  readonly position: Point;
}

export interface GlobalObservation {
  // Game seconds since the bot started playing.
  readonly time: number;
  readonly ownStartPosition: Point;
  readonly enemyStartPosition?: Point;
  // Enemy players still in the game; a defeated player is no longer counted.
  readonly enemyPlayersPlaying: number;

  // Every living unit of the bot, including buildings.
  readonly ownUnits: ReadonlyMap<W3UnitApi.unit, OwnUnit>;
  // Living units with the worker classification.
  readonly workers: readonly OwnUnit[];
  readonly townHall?: W3UnitApi.unit;
  readonly peasants: readonly W3UnitApi.unit[];
  readonly militia: readonly W3UnitApi.unit[];
  readonly idleUnits: readonly W3UnitApi.unit[];
  readonly harvestingUnits: readonly W3UnitApi.unit[];
  readonly holdingPositionUnits: readonly W3UnitApi.unit[];
  readonly repairingUnits: readonly W3UnitApi.unit[];
  // Units whose current order is to build a Scout Tower.
  readonly scoutTowerBuildOrderUnits: readonly W3UnitApi.unit[];
  // Includes towers still under construction.
  readonly scoutTowers: readonly W3UnitApi.unit[];
  readonly guardTowers: readonly W3UnitApi.unit[];
  // Includes Lumber Mills still under construction.
  readonly lumberMills: readonly W3UnitApi.unit[];
  readonly buildingsUnderConstruction: readonly W3UnitApi.unit[];
  readonly buildingsUpgrading: readonly W3UnitApi.unit[];

  readonly visibleEnemies: readonly VisibleEnemy[];

  readonly gold: number;
  readonly lumber: number;
  readonly homeGoldMine?: GoldMine;
  readonly enemyMainGoldMine?: GoldMine;
  readonly destructablesNearHomeByDistance: readonly HomeDestructable[];
}

/**
 * Everything the bot believes is currently observed; retained and inferred
 * beliefs do not exist yet.
 */
export type GlobalBeliefs = GlobalObservation;

/**
 * Observes Warcraft state and revises it into the bot's one global Beliefs
 * snapshot, which all reasoning reads.
 */
export class GlobalBeliefModel
  implements BeliefModel<GlobalObservation, GlobalBeliefs>
{
  public readonly dependencies = undefined;
  private readonly bot: W3PlayerApi.player;
  private readonly clock: GameClock;
  private readonly attackObserver: AttackObserver;

  public constructor(bot: W3PlayerApi.player) {
    this.bot = bot;
    this.clock = startGameClock();
    this.attackObserver = observeAttacksOn(bot, this.clock);
  }

  public observe(): GlobalObservation {
    return observeWorld(this.bot, this.clock, this.attackObserver);
  }

  public revise(
    _previous: Readonly<GlobalBeliefs> | undefined,
    observation: Readonly<GlobalObservation>,
  ): GlobalBeliefs {
    return observation;
  }
}

/** Throws for a unit not believed to be a living unit of the bot. */
export function ownUnit(
  beliefs: Readonly<GlobalBeliefs>,
  unit: W3UnitApi.unit,
): OwnUnit {
  const believed = beliefs.ownUnits.get(unit);

  if (!believed) {
    throw new Error("Beliefs: not a living unit of the bot.");
  }

  return believed;
}

export function positionOf(
  beliefs: Readonly<GlobalBeliefs>,
  unit: W3UnitApi.unit,
): Point {
  return ownUnit(beliefs, unit).position;
}

export function lifeFractionOf(
  beliefs: Readonly<GlobalBeliefs>,
  unit: W3UnitApi.unit,
): number {
  const { life, maxLife } = ownUnit(beliefs, unit);

  return life / maxLife;
}

function observeWorld(
  bot: W3PlayerApi.player,
  clock: GameClock,
  attackObserver: AttackObserver,
): GlobalObservation {
  const ownStartPosition = startPositionOf(bot);
  const enemies = enemyPlayers(bot);
  const enemy = enemies[0];
  const enemyStartPosition = enemy && startPositionOf(enemy);

  const ownUnits = new Map<W3UnitApi.unit, OwnUnit>();
  const workers: OwnUnit[] = [];
  let townHall: W3UnitApi.unit | undefined;
  const peasants: W3UnitApi.unit[] = [];
  const militia: W3UnitApi.unit[] = [];
  const idleUnits: W3UnitApi.unit[] = [];
  const harvestingUnits: W3UnitApi.unit[] = [];
  const holdingPositionUnits: W3UnitApi.unit[] = [];
  const repairingUnits: W3UnitApi.unit[] = [];
  const scoutTowerBuildOrderUnits: W3UnitApi.unit[] = [];
  const scoutTowers: W3UnitApi.unit[] = [];
  const guardTowers: W3UnitApi.unit[] = [];
  const lumberMills: W3UnitApi.unit[] = [];
  const buildingsUnderConstruction: W3UnitApi.unit[] = [];
  const buildingsUpgrading: W3UnitApi.unit[] = [];

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
    const observed: OwnUnit = {
      unit,
      position: unitPosition(unit),
      life: W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE),
      maxLife: W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_MAX_LIFE),
      isIdle: order === NO_ORDER,
      isAttacked: isRecentlyAttacked(attackObserver, unit),
    };

    ownUnits.set(unit, observed);

    if (W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_PEON)) {
      workers.push(observed);
    }

    if (order === NO_ORDER) {
      idleUnits.push(unit);
    } else if (harvestOrders.includes(order)) {
      harvestingUnits.push(unit);
    } else if (order === holdPositionOrder) {
      holdingPositionUnits.push(unit);
    } else if (order === repairOrder) {
      repairingUnits.push(unit);
    } else if (order === SCOUT_TOWER_BUILD_ORDER) {
      scoutTowerBuildOrderUnits.push(unit);
    }

    const typeId = W3UnitApi.GetUnitTypeId(unit);

    if (typeId === W3HumanApi.Unit.PEASANT) {
      peasants.push(unit);
    } else if (typeId === W3HumanApi.Unit.MILITIA) {
      militia.push(unit);
    } else if (typeId === W3HumanApi.Building.TOWN_HALL) {
      townHall = unit;
    } else if (typeId === W3HumanApi.Building.SCOUT_TOWER) {
      scoutTowers.push(unit);
    } else if (typeId === W3HumanApi.Building.GUARD_TOWER) {
      guardTowers.push(unit);
    } else if (typeId === W3HumanApi.Building.LUMBER_MILL) {
      lumberMills.push(unit);
    }

    // An upgrading building also has the under-construction ability.
    if (
      W3UnitApi.GetUnitAbilityLevel(unit, W3UnitApi.Ability.BUILDING_UPGRADING) >
      0
    ) {
      buildingsUpgrading.push(unit);
    } else if (
      W3UnitApi.GetUnitAbilityLevel(
        unit,
        W3UnitApi.Ability.BUILDING_UNDER_CONSTRUCTION,
      ) > 0
    ) {
      buildingsUnderConstruction.push(unit);
    }
  }

  return {
    time: readGameClock(clock),
    ownStartPosition,
    enemyStartPosition,
    enemyPlayersPlaying: enemies.length,
    ownUnits,
    workers,
    townHall,
    peasants,
    militia,
    idleUnits,
    harvestingUnits,
    holdingPositionUnits,
    repairingUnits,
    scoutTowerBuildOrderUnits,
    scoutTowers,
    guardTowers,
    lumberMills,
    buildingsUnderConstruction,
    buildingsUpgrading,
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

function unitPosition(unit: W3UnitApi.unit): Point {
  return new Point(W3UnitApi.GetUnitX(unit), W3UnitApi.GetUnitY(unit));
}

function startPositionOf(whichPlayer: W3PlayerApi.player): Point {
  const startLocation = W3PlayerApi.GetPlayerStartLocation(whichPlayer);

  return new Point(
    W3LocationApi.GetStartLocationX(startLocation),
    W3LocationApi.GetStartLocationY(startLocation),
  );
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

      const isStructure = W3UnitApi.IsUnitType(
        unit,
        W3UnitApi.UNIT_TYPE_STRUCTURE,
      );

      visible.push({
        unit,
        position: unitPosition(unit),
        life: W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE),
        isMelee: W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_MELEE_ATTACKER),
        isRanged: W3UnitApi.IsUnitType(
          unit,
          W3UnitApi.UNIT_TYPE_RANGED_ATTACKER,
        ),
        isSiege: SIEGE_UNIT_TYPES.includes(W3UnitApi.GetUnitTypeId(unit)),
        isStructure,
        isWorker: W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_PEON),
        // Assumed, not verified in-game: an Ancient loses the structure
        // classification while uprooted.
        isUprootedAncient:
          !isStructure && W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_ANCIENT),
        attackTarget: recentAttackTarget(attackObserver, unit),
      });
    }
  }

  return visible;
}

function findClosestGoldMine(position: Point): GoldMine | undefined {
  let closest: GoldMine | undefined;
  let closestDistance = Infinity;

  for (const unit of unitsInRange(position, MAIN_GOLD_MINE_SEARCH_RADIUS)) {
    if (!GOLD_MINE_TYPES.includes(W3UnitApi.GetUnitTypeId(unit))) {
      continue;
    }

    const minePosition = unitPosition(unit);
    const distance = new Vector(position, minePosition).length;

    if (distance < closestDistance) {
      closest = { unit, position: minePosition };
      closestDistance = distance;
    }
  }

  return closest;
}

function destructablesByDistance(
  position: Point,
  radius: number,
): HomeDestructable[] {
  const min = position.translate(new Vector(-radius, -radius));
  const max = position.translate(new Vector(radius, radius));
  const area = W3RectApi.Rect(min.x, min.y, max.x, max.y);
  const found: { destructable: HomeDestructable; distance: number }[] = [];

  W3DestructableApi.EnumDestructablesInRect(area, undefined, () => {
    const destructable = W3DestructableApi.GetEnumDestructable();

    if (destructable && isDestructableAlive(destructable)) {
      const destructablePosition = new Point(
        W3DestructableApi.GetDestructableX(destructable),
        W3DestructableApi.GetDestructableY(destructable),
      );

      found.push({
        destructable: { destructable, position: destructablePosition },
        distance: new Vector(position, destructablePosition).length,
      });
    }
  });
  W3RectApi.RemoveRect(area);

  found.sort((a, b) => a.distance - b.distance);

  return found.map((entry) => entry.destructable);
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
