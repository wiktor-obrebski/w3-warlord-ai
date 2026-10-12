import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3UnitApi from '@lib/warcraft3-api/unit';
import * as W3GroupApi from '@lib/warcraft3-api/group';
import * as W3LocationApi from '@lib/warcraft3-api/location';
import * as W3HumanApi from '@lib/warcraft3-api/human';
import * as W3NeutralApi from '@lib/warcraft3-api/neutral';
import * as W3NightElfApi from '@lib/warcraft3-api/nightelf';
import * as W3UndeadApi from '@lib/warcraft3-api/undead';
import * as W3RectApi from '@lib/warcraft3-api/rect';
import * as W3DestructableApi from '@lib/warcraft3-api/destructable';
import * as W3OrcApi from '@lib/warcraft3-api/orc';
import { CommonBeliefsModel } from '@lib/bdi';
import { Point, Vector } from '@lib/math';
import {
  ObservedAttack,
  observeAttacksOn,
  takeObservedAttacks,
} from './attack-observer';
import { GameClock, readGameClock, startGameClock } from './game-clock';

export {
  type OwnUnit,
  type VisibleEnemy,
  type GoldMine,
  type HomeDestructable,
  type ObservedWorld,
  type CommonObservation,
  type CommonBeliefs,
  createCommonBeliefsModel,
};

type UnitGroup = ReturnType<typeof W3GroupApi.CreateGroup>;

const MainGoldMineSearchRadius = 1500;
const HomeDestructableSearchRadius = 1500;
// Night Elf and Undead melee starts replace their main mine with an
// entangled or haunted one and hide the original, which range enumeration
// then skips.
const GoldMineTypes: number[] = [
  W3NeutralApi.Building.GOLD_MINE,
  W3NightElfApi.Building.ENTANGLED_GOLD_MINE,
  W3UndeadApi.Building.HAUNTED_GOLD_MINE,
];
// Warcraft has no siege classification for units; these are the units whose
// attack type is siege.
const SiegeUnitTypes: number[] = [
  W3HumanApi.Unit.MORTAR_TEAM,
  W3HumanApi.Unit.SIEGE_ENGINE,
  W3HumanApi.Unit.SIEGE_ENGINE_WITH_BARRAGE,
  W3OrcApi.Unit.DEMOLISHER,
  W3NightElfApi.Unit.GLAIVE_THROWER,
  W3UndeadApi.Unit.MEAT_WAGON,
];
const NoOrder = 0;
// Assumed, not verified in-game: a build order's id is the rawcode of the
// building, as with IssueBuildOrderById.
const ScoutTowerBuildOrder: number = W3HumanApi.Building.SCOUT_TOWER;
const HarvestOrderStrings = ['harvest', 'resumeharvesting', 'returnresources'];
// Warcraft treats units at or below this life as dead.
const DeadUnitLife = 0.405;

// Warcraft offers no way to read whom a unit is attacking, so attacks are
// observed as they start and remembered for a short while afterwards. The
// window is kept short so units stop counting as attacked soon after the
// attacks end; slow attackers, such as siege units, start an attack only
// every few seconds and so are remembered only part of the time.
const AttackMemorySeconds = 1;

interface OwnUnit {
  readonly unit: W3UnitApi.unit;
  readonly position: Point;
  readonly life: number;
  readonly maxLife: number;
  readonly isIdle: boolean;
}

// The handle is only for targeting orders; reasoning reads the observed
// properties, which are collected only while the unit is visible.
interface VisibleEnemy {
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
}

interface GoldMine {
  readonly unit: W3UnitApi.unit;
  readonly position: Point;
}

interface HomeDestructable {
  readonly destructable: W3DestructableApi.destructable;
  readonly position: Point;
}

interface ObservedWorld {
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

interface CommonObservation {
  readonly world: ObservedWorld;
  readonly attacksStarted: readonly ObservedAttack[];
}

/**
 * Game knowledge broadly useful to the bot: the currently observed world,
 * and the attacks on the bot's units it still remembers.
 */
interface CommonBeliefs extends ObservedWorld {
  // The latest attack of each attacker, while still recent; oldest first.
  readonly recentAttacks: readonly ObservedAttack[];
}

interface CreateCommonBeliefsModelArgs {
  bot: W3PlayerApi.player;
}

/**
 * Maintains the Common Beliefs every component reads, revised by the runtime
 * at the start of every tick.
 */
function createCommonBeliefsModel({
  bot,
}: CreateCommonBeliefsModelArgs): CommonBeliefsModel<
  CommonObservation,
  CommonBeliefs
> {
  const clock = startGameClock();
  const attackObserver = observeAttacksOn({ bot, clock });

  return {
    observe() {
      return {
        world: observeWorld({ bot, clock }),
        attacksStarted: takeObservedAttacks({ observer: attackObserver }),
      };
    },

    revise({ previous, observation }) {
      return {
        ...observation.world,
        recentAttacks: reviseRecentAttacks({
          previous: previous?.recentAttacks ?? [],
          started: observation.attacksStarted,
          now: observation.world.time,
        }),
      };
    },
  };
}

interface ReviseRecentAttacksArgs {
  previous: readonly ObservedAttack[];
  started: readonly ObservedAttack[];
  now: number;
}

// Unchanged memory is returned as it is, so it is not copied every tick.
function reviseRecentAttacks({
  previous,
  started,
  now,
}: ReviseRecentAttacksArgs): readonly ObservedAttack[] {
  const isRecent = ({ attack }: { attack: ObservedAttack }) =>
    now - attack.time <= AttackMemorySeconds;

  if (
    started.length === 0 &&
    previous.every((attack) => isRecent({ attack }))
  ) {
    return previous;
  }

  let attacks = previous.filter((attack) => isRecent({ attack }));

  for (const attack of started) {
    attacks = attacks.filter((known) => known.attacker !== attack.attacker);
    attacks.push(attack);
  }

  return attacks;
}

interface ObserveWorldArgs {
  bot: W3PlayerApi.player;
  clock: GameClock;
}

function observeWorld({ bot, clock }: ObserveWorldArgs): ObservedWorld {
  const ownStartPosition = startPositionOf({ whichPlayer: bot });
  const enemies = enemyPlayers({ bot });
  const enemy = enemies[0];
  const enemyStartPosition = enemy && startPositionOf({ whichPlayer: enemy });

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
  const harvestOrders = HarvestOrderStrings.map((order) =>
    W3UnitApi.OrderId(order)
  );
  const holdPositionOrder = W3UnitApi.OrderId('holdposition');
  // Assumed, not verified in-game, to stay the current order while repairing.
  const repairOrder = W3UnitApi.OrderId('repair');

  for (const unit of unitsOfPlayer({ whichPlayer: bot })) {
    if (!isUnitAlive({ unit })) {
      continue;
    }

    const order = W3UnitApi.GetUnitCurrentOrder(unit);
    const observed: OwnUnit = {
      unit,
      position: unitPosition({ unit }),
      life: W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE),
      maxLife: W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_MAX_LIFE),
      isIdle: order === NoOrder,
    };

    ownUnits.set(unit, observed);

    if (W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_PEON)) {
      workers.push(observed);
    }

    if (order === NoOrder) {
      idleUnits.push(unit);
    } else if (harvestOrders.includes(order)) {
      harvestingUnits.push(unit);
    } else if (order === holdPositionOrder) {
      holdingPositionUnits.push(unit);
    } else if (order === repairOrder) {
      repairingUnits.push(unit);
    } else if (order === ScoutTowerBuildOrder) {
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
      W3UnitApi.GetUnitAbilityLevel(
        unit,
        W3UnitApi.Ability.BUILDING_UPGRADING
      ) > 0
    ) {
      buildingsUpgrading.push(unit);
    } else if (
      W3UnitApi.GetUnitAbilityLevel(
        unit,
        W3UnitApi.Ability.BUILDING_UNDER_CONSTRUCTION
      ) > 0
    ) {
      buildingsUnderConstruction.push(unit);
    }
  }

  return {
    time: readGameClock({ clock }),
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
    visibleEnemies: visibleEnemies({ bot, enemies }),
    gold: W3PlayerApi.GetPlayerState(
      bot,
      W3PlayerApi.PLAYER_STATE_RESOURCE_GOLD
    ),
    lumber: W3PlayerApi.GetPlayerState(
      bot,
      W3PlayerApi.PLAYER_STATE_RESOURCE_LUMBER
    ),
    homeGoldMine: findClosestGoldMine({ position: ownStartPosition }),
    // Gold mine placement is static map knowledge, visible to any player
    // before scouting, so reading it under fog is fair.
    enemyMainGoldMine:
      enemyStartPosition &&
      findClosestGoldMine({ position: enemyStartPosition }),
    destructablesNearHomeByDistance: destructablesByDistance({
      position: ownStartPosition,
      radius: HomeDestructableSearchRadius,
    }),
  };
}

function isUnitAlive({ unit }: { unit: W3UnitApi.unit }): boolean {
  return W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE) > DeadUnitLife;
}

interface IsDestructableAliveArgs {
  destructable: W3DestructableApi.destructable;
}

function isDestructableAlive({
  destructable,
}: IsDestructableAliveArgs): boolean {
  return W3DestructableApi.GetDestructableLife(destructable) > 0;
}

function unitPosition({ unit }: { unit: W3UnitApi.unit }): Point {
  return new Point({
    x: W3UnitApi.GetUnitX(unit),
    y: W3UnitApi.GetUnitY(unit),
  });
}

interface StartPositionOfArgs {
  whichPlayer: W3PlayerApi.player;
}

function startPositionOf({ whichPlayer }: StartPositionOfArgs): Point {
  const startLocation = W3PlayerApi.GetPlayerStartLocation(whichPlayer);

  return new Point({
    x: W3LocationApi.GetStartLocationX(startLocation),
    y: W3LocationApi.GetStartLocationY(startLocation),
  });
}

interface EnemyPlayersArgs {
  bot: W3PlayerApi.player;
}

function enemyPlayers({ bot }: EnemyPlayersArgs): W3PlayerApi.player[] {
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

interface VisibleEnemiesArgs {
  bot: W3PlayerApi.player;
  enemies: W3PlayerApi.player[];
}

function visibleEnemies({ bot, enemies }: VisibleEnemiesArgs): VisibleEnemy[] {
  const visible: VisibleEnemy[] = [];

  for (const enemy of enemies) {
    for (const unit of unitsOfPlayer({ whichPlayer: enemy })) {
      if (!isUnitAlive({ unit }) || !W3UnitApi.IsUnitVisible(unit, bot)) {
        continue;
      }

      const isStructure = W3UnitApi.IsUnitType(
        unit,
        W3UnitApi.UNIT_TYPE_STRUCTURE
      );

      visible.push({
        unit,
        position: unitPosition({ unit }),
        life: W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE),
        isMelee: W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_MELEE_ATTACKER),
        isRanged: W3UnitApi.IsUnitType(
          unit,
          W3UnitApi.UNIT_TYPE_RANGED_ATTACKER
        ),
        isSiege: SiegeUnitTypes.includes(W3UnitApi.GetUnitTypeId(unit)),
        isStructure,
        isWorker: W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_PEON),
        // Assumed, not verified in-game: an Ancient loses the structure
        // classification while uprooted.
        isUprootedAncient:
          !isStructure &&
          W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_ANCIENT),
      });
    }
  }

  return visible;
}

interface FindClosestGoldMineArgs {
  position: Point;
}

function findClosestGoldMine({
  position,
}: FindClosestGoldMineArgs): GoldMine | undefined {
  let closest: GoldMine | undefined;
  let closestDistance = Infinity;

  for (const unit of unitsInRange({
    position,
    radius: MainGoldMineSearchRadius,
  })) {
    if (!GoldMineTypes.includes(W3UnitApi.GetUnitTypeId(unit))) {
      continue;
    }

    const minePosition = unitPosition({ unit });
    const distance = new Vector({ start: position, end: minePosition }).length;

    if (distance < closestDistance) {
      closest = { unit, position: minePosition };
      closestDistance = distance;
    }
  }

  return closest;
}

interface DestructablesByDistanceArgs {
  position: Point;
  radius: number;
}

function destructablesByDistance({
  position,
  radius,
}: DestructablesByDistanceArgs): HomeDestructable[] {
  const min = position.translate({
    vector: new Vector({ x: -radius, y: -radius }),
  });
  const max = position.translate({
    vector: new Vector({ x: radius, y: radius }),
  });
  const area = W3RectApi.Rect(min.x, min.y, max.x, max.y);
  const found: { destructable: HomeDestructable; distance: number }[] = [];

  W3DestructableApi.EnumDestructablesInRect(area, undefined, () => {
    const destructable = W3DestructableApi.GetEnumDestructable();

    if (destructable && isDestructableAlive({ destructable })) {
      const destructablePosition = new Point({
        x: W3DestructableApi.GetDestructableX(destructable),
        y: W3DestructableApi.GetDestructableY(destructable),
      });

      found.push({
        destructable: { destructable, position: destructablePosition },
        distance: new Vector({ start: position, end: destructablePosition })
          .length,
      });
    }
  });
  W3RectApi.RemoveRect(area);

  found.sort((a, b) => a.distance - b.distance);

  return found.map((nearby) => nearby.destructable);
}

interface UnitsOfPlayerArgs {
  whichPlayer: W3PlayerApi.player;
}

function unitsOfPlayer({ whichPlayer }: UnitsOfPlayerArgs): W3UnitApi.unit[] {
  const group = W3GroupApi.CreateGroup();
  W3GroupApi.GroupEnumUnitsOfPlayer(group, whichPlayer, null);
  return drainGroup({ whichGroup: group });
}

interface UnitsInRangeArgs {
  position: Point;
  radius: number;
}

function unitsInRange({
  position,
  radius,
}: UnitsInRangeArgs): W3UnitApi.unit[] {
  const group = W3GroupApi.CreateGroup();

  W3GroupApi.GroupEnumUnitsInRange(group, position.x, position.y, radius, null);
  return drainGroup({ whichGroup: group });
}

interface DrainGroupArgs {
  whichGroup: UnitGroup;
}

function drainGroup({ whichGroup }: DrainGroupArgs): W3UnitApi.unit[] {
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
