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
import { Point, Vector } from '@lib/math';
import type { DestructableId, UnitId } from '../contracts/ids';
import type { Observations, ObservedWorld } from '../contracts/observations';
import type { OrderTicket } from '../contracts/orders';
import type {
  GoldMine,
  HomeDestructable,
  ObservedAttack,
  OwnUnit,
  Race,
  StartLocation,
  VisibleEnemy,
} from '../contracts/world';
import {
  AttackEvent,
  observeAttacksOn,
  takeObservedAttacks,
} from './attack-observer';
import { GameClock, readGameClock, startGameClock } from './game-clock';
import { HandleIds, createHandleIds } from './handle-ids';

export { type Perception, createPerception };

interface PerceptionObserveArgs {
  refusedOrders: readonly OrderTicket[];
}

/**
 * The only code reading Warcraft state for decisions. It reports what the
 * bot's player may legitimately know, naming units and destructables by ids;
 * the handles behind the ids stay here, for the order executor.
 */
interface Perception {
  /**
   * What the bot can see now, together with the previous step's orders that
   * Warcraft refused.
   */
  observe({ refusedOrders }: PerceptionObserveArgs): Observations;
  readonly unitIds: HandleIds<W3UnitApi.unit, UnitId>;
  readonly destructableIds: HandleIds<
    W3DestructableApi.destructable,
    DestructableId
  >;
}

function createPerception({ bot }: { bot: W3PlayerApi.player }): Perception {
  const clock = startGameClock();
  const attackObserver = observeAttacksOn({ bot, clock });
  const unitIds = createHandleIds<W3UnitApi.unit, UnitId>();
  const destructableIds = createHandleIds<
    W3DestructableApi.destructable,
    DestructableId
  >();

  return {
    unitIds,
    destructableIds,

    observe({ refusedOrders }) {
      const kept: KeptHandles = {
        units: new Set(),
        destructables: new Set(),
      };
      const handles: ObservedHandles = { unitIds, destructableIds, kept };
      const world = observeWorld({ bot, clock, handles });
      const attacksStarted = takeObservedAttacks({
        observer: attackObserver,
      }).map((attack) => observedAttack({ attack, handles }));

      unitIds.keepOnly({ handles: kept.units });
      destructableIds.keepOnly({ handles: kept.destructables });

      return { world, attacksStarted, refusedOrders };
    },
  };
}

// The handles that keep their ids after this observation: everything still
// alive that the bot has an id for, or has just been given one.
interface KeptHandles {
  units: Set<W3UnitApi.unit>;
  destructables: Set<W3DestructableApi.destructable>;
}

interface ObservedHandles {
  unitIds: HandleIds<W3UnitApi.unit, UnitId>;
  destructableIds: HandleIds<W3DestructableApi.destructable, DestructableId>;
  kept: KeptHandles;
}

interface UnitIdOfArgs {
  unit: W3UnitApi.unit;
  handles: ObservedHandles;
}

function unitIdOf({ unit, handles }: UnitIdOfArgs): UnitId {
  handles.kept.units.add(unit);

  return handles.unitIds.idOf({ handle: unit });
}

interface ObservedAttackArgs {
  attack: AttackEvent;
  handles: ObservedHandles;
}

function observedAttack({
  attack,
  handles,
}: ObservedAttackArgs): ObservedAttack {
  return {
    attacker: attack.attackerVisible
      ? unitIdOf({ unit: attack.attacker, handles })
      : null,
    attackedUnit: unitIdOf({ unit: attack.attackedUnit, handles }),
    time: attack.time,
  };
}

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
// A build order's id is the rawcode of the building, as with
// IssueBuildOrderById; the tower rush's tracking of its build orders shows it
// in-game.
const ScoutTowerBuildOrder: number = W3HumanApi.Building.SCOUT_TOWER;
const HarvestOrderStrings = ['harvest', 'resumeharvesting', 'returnresources'];
// Warcraft treats units at or below this life as dead.
const DeadUnitLife = 0.405;

interface ObserveWorldArgs {
  bot: W3PlayerApi.player;
  clock: GameClock;
  handles: ObservedHandles;
}

function observeWorld({
  bot,
  clock,
  handles,
}: ObserveWorldArgs): ObservedWorld {
  const ownStartLocation = W3PlayerApi.GetPlayerStartLocation(bot);
  const ownStartPosition = startLocationPosition({
    startLocation: ownStartLocation,
  });
  const enemies = enemyPlayers({ bot });

  const ownUnits = new Map<UnitId, OwnUnit>();
  const workers: OwnUnit[] = [];
  let townHall: UnitId | undefined;
  const peasants: UnitId[] = [];
  const militia: UnitId[] = [];
  const idleUnits: UnitId[] = [];
  const movingUnits: UnitId[] = [];
  const harvestingUnits: UnitId[] = [];
  const holdingPositionUnits: UnitId[] = [];
  const repairingUnits: UnitId[] = [];
  const scoutTowerBuildOrderUnits: UnitId[] = [];
  const scoutTowers: UnitId[] = [];
  const guardTowers: UnitId[] = [];
  const lumberMills: UnitId[] = [];
  const buildingsUnderConstruction: UnitId[] = [];
  const buildingsUpgrading: UnitId[] = [];

  // Looked up per call because OrderId returns 0 during map init.
  const harvestOrders = HarvestOrderStrings.map((order) =>
    W3UnitApi.OrderId(order)
  );
  const moveOrder = W3UnitApi.OrderId('move');
  const holdPositionOrder = W3UnitApi.OrderId('holdposition');
  // Assumed, not verified in-game, to stay the current order while repairing.
  const repairOrder = W3UnitApi.OrderId('repair');

  for (const unit of unitsOfPlayer({ whichPlayer: bot })) {
    if (!isUnitAlive({ unit })) {
      continue;
    }

    const id = unitIdOf({ unit, handles });
    const order = W3UnitApi.GetUnitCurrentOrder(unit);
    const observed: OwnUnit = {
      unit: id,
      position: unitPosition({ unit }),
      life: W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_LIFE),
      maxLife: W3UnitApi.GetUnitState(unit, W3UnitApi.UNIT_STATE_MAX_LIFE),
      isIdle: order === NoOrder,
      order,
    };

    ownUnits.set(id, observed);

    if (W3UnitApi.IsUnitType(unit, W3UnitApi.UNIT_TYPE_PEON)) {
      workers.push(observed);
    }

    if (order === NoOrder) {
      idleUnits.push(id);
    } else if (order === moveOrder) {
      movingUnits.push(id);
    } else if (harvestOrders.includes(order)) {
      harvestingUnits.push(id);
    } else if (order === holdPositionOrder) {
      holdingPositionUnits.push(id);
    } else if (order === repairOrder) {
      repairingUnits.push(id);
    } else if (order === ScoutTowerBuildOrder) {
      scoutTowerBuildOrderUnits.push(id);
    }

    const typeId = W3UnitApi.GetUnitTypeId(unit);

    if (typeId === W3HumanApi.Unit.PEASANT) {
      peasants.push(id);
    } else if (typeId === W3HumanApi.Unit.MILITIA) {
      militia.push(id);
    } else if (typeId === W3HumanApi.Building.TOWN_HALL) {
      townHall = id;
    } else if (typeId === W3HumanApi.Building.SCOUT_TOWER) {
      scoutTowers.push(id);
    } else if (typeId === W3HumanApi.Building.GUARD_TOWER) {
      guardTowers.push(id);
    } else if (typeId === W3HumanApi.Building.LUMBER_MILL) {
      lumberMills.push(id);
    }

    // An upgrading building also has the under-construction ability.
    if (
      W3UnitApi.GetUnitAbilityLevel(
        unit,
        W3UnitApi.Ability.BUILDING_UPGRADING
      ) > 0
    ) {
      buildingsUpgrading.push(id);
    } else if (
      W3UnitApi.GetUnitAbilityLevel(
        unit,
        W3UnitApi.Ability.BUILDING_UNDER_CONSTRUCTION
      ) > 0
    ) {
      buildingsUnderConstruction.push(id);
    }
  }

  return {
    time: readGameClock({ clock }),
    otherStartLocations: otherStartLocations({ ownStartLocation, handles }),
    self: {
      race: raceOf({ whichPlayer: bot }),
      startPosition: ownStartPosition,
      units: ownUnits,
      workers,
      townHall,
      peasants,
      militia,
      idleUnits,
      movingUnits,
      harvestingUnits,
      holdingPositionUnits,
      repairingUnits,
      scoutTowerBuildOrderUnits,
      scoutTowers,
      guardTowers,
      lumberMills,
      buildingsUnderConstruction,
      buildingsUpgrading,
      gold: W3PlayerApi.GetPlayerState(
        bot,
        W3PlayerApi.PLAYER_STATE_RESOURCE_GOLD
      ),
      lumber: W3PlayerApi.GetPlayerState(
        bot,
        W3PlayerApi.PLAYER_STATE_RESOURCE_LUMBER
      ),
      homeGoldMine: findClosestGoldMine({
        position: ownStartPosition,
        handles,
      }),
      destructablesNearHomeByDistance: destructablesByDistance({
        position: ownStartPosition,
        radius: HomeDestructableSearchRadius,
        handles,
      }),
    },
    enemy: {
      playersPlaying: enemies.length,
      visibleUnits: visibleEnemies({ bot, enemies, handles }),
    },
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

function startLocationPosition({
  startLocation,
}: {
  startLocation: number;
}): Point {
  return new Point({
    x: W3LocationApi.GetStartLocationX(startLocation),
    y: W3LocationApi.GetStartLocationY(startLocation),
  });
}

interface OtherStartLocationsArgs {
  ownStartLocation: number;
  handles: ObservedHandles;
}

// The map's start locations and their gold mines are static map knowledge,
// shown to every player before scouting, so reading them under fog is fair.
// Which start location an enemy got is not read.
function otherStartLocations({
  ownStartLocation,
  handles,
}: OtherStartLocationsArgs): StartLocation[] {
  const locations: StartLocation[] = [];

  for (
    let startLocation = 0;
    startLocation < W3PlayerApi.GetPlayers();
    startLocation++
  ) {
    if (startLocation !== ownStartLocation) {
      const position = startLocationPosition({ startLocation });

      locations.push({
        position,
        goldMine: findClosestGoldMine({ position, handles }),
      });
    }
  }

  return locations;
}

// Race handles are constant, so they compare by identity.
function raceOf({ whichPlayer }: { whichPlayer: W3PlayerApi.player }): Race {
  const race = W3PlayerApi.GetPlayerRace(whichPlayer);

  if (race === W3PlayerApi.RACE_HUMAN) {
    return 'Human';
  }

  if (race === W3PlayerApi.RACE_ORC) {
    return 'Orc';
  }

  if (race === W3PlayerApi.RACE_UNDEAD) {
    return 'Undead';
  }

  if (race === W3PlayerApi.RACE_NIGHTELF) {
    return 'NightElf';
  }

  throw new Error('Perception: the player plays no melee race.');
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
  handles: ObservedHandles;
}

// An enemy unit keeps its id while it lives, also out of sight, as the
// handles behind the first iteration's beliefs did.
function visibleEnemies({
  bot,
  enemies,
  handles,
}: VisibleEnemiesArgs): VisibleEnemy[] {
  const visible: VisibleEnemy[] = [];

  for (const enemy of enemies) {
    for (const unit of unitsOfPlayer({ whichPlayer: enemy })) {
      if (!isUnitAlive({ unit })) {
        continue;
      }

      handles.kept.units.add(unit);

      if (!W3UnitApi.IsUnitVisible(unit, bot)) {
        continue;
      }

      const isStructure = W3UnitApi.IsUnitType(
        unit,
        W3UnitApi.UNIT_TYPE_STRUCTURE
      );

      visible.push({
        unit: unitIdOf({ unit, handles }),
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
  handles: ObservedHandles;
}

function findClosestGoldMine({
  position,
  handles,
}: FindClosestGoldMineArgs): GoldMine | undefined {
  let closest: { unit: W3UnitApi.unit; position: Point } | undefined;
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

  return (
    closest && {
      unit: unitIdOf({ unit: closest.unit, handles }),
      position: closest.position,
    }
  );
}

interface DestructablesByDistanceArgs {
  position: Point;
  radius: number;
  handles: ObservedHandles;
}

function destructablesByDistance({
  position,
  radius,
  handles,
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

      handles.kept.destructables.add(destructable);
      found.push({
        destructable: {
          destructable: handles.destructableIds.idOf({ handle: destructable }),
          position: destructablePosition,
        },
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
