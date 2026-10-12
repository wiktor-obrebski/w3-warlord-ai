import type * as W3UnitApi from '@lib/warcraft3-api/unit';
import type * as W3DestructableApi from '@lib/warcraft3-api/destructable';
import type { Point } from '@lib/math';

export {
  type OwnUnit,
  type VisibleEnemy,
  type GoldMine,
  type HomeDestructable,
  type ObservedAttack,
};

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

interface ObservedAttack {
  readonly attacker: W3UnitApi.unit;
  readonly attackedUnit: W3UnitApi.unit;
  // Game seconds at which the attack started.
  readonly time: number;
}
