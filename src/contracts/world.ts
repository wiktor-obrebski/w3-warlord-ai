import type { Point } from '@lib/math';
import type { DestructableId, UnitId } from './ids';

export {
  type Race,
  type OwnUnit,
  type VisibleEnemy,
  type GoldMine,
  type StartLocation,
  type HomeDestructable,
  type ObservedAttack,
};

type Race = 'Human' | 'Orc' | 'Undead' | 'NightElf';

interface OwnUnit {
  readonly unit: UnitId;
  readonly position: Point;
  readonly life: number;
  readonly maxLife: number;
  readonly isIdle: boolean;
  // The id of the unit's current order, 0 for none. A build order's id is
  // assumed, not verified in-game, to be the rawcode of the building.
  readonly order: number;
}

// The observed properties are collected only while the unit is visible.
interface VisibleEnemy {
  readonly unit: UnitId;
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
  readonly unit: UnitId;
  readonly position: Point;
}

// A start location of the map, with the gold mine closest to it.
interface StartLocation {
  readonly position: Point;
  readonly goldMine?: GoldMine;
}

interface HomeDestructable {
  readonly destructable: DestructableId;
  readonly position: Point;
}

interface ObservedAttack {
  // Null when the attacker was not visible as the attack started.
  readonly attacker: UnitId | null;
  readonly attackedUnit: UnitId;
  // Game seconds at which the attack started.
  readonly time: number;
}
