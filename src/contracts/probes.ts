import type { Point } from '@lib/math';
import type { DestructableId, UnitId } from './ids';

export { type WarcraftProbes };

interface WarcraftProbesTryBuildArgs {
  unit: UnitId;
  // The rawcode of the building.
  building: number;
  point: Point;
}

interface WarcraftProbesTryHarvestArgs {
  unit: UnitId;
  destructable: DestructableId;
}

interface WarcraftProbesTryAttackArgs {
  unit: UnitId;
  target: UnitId;
}

interface WarcraftProbesIsInRangeArgs {
  unit: UnitId;
  target: UnitId;
  range: number;
}

/**
 * The Warcraft calls the mind still makes directly, until later work
 * replaces them: orders whose acceptance is a test, issued at once, and two
 * static reads. They take ids; the shell maps them to handles.
 * An order for a unit that no longer exists counts as refused.
 */
interface WarcraftProbes {
  /** Orders a build now; Warcraft refuses it for a blocked or unbuildable spot. */
  tryBuild({ unit, building, point }: WarcraftProbesTryBuildArgs): boolean;
  /** Orders a harvest now; Warcraft refuses it for anything but a tree. */
  tryHarvest({ unit, destructable }: WarcraftProbesTryHarvestArgs): boolean;
  /** Orders an attack now. */
  tryAttack({ unit, target }: WarcraftProbesTryAttackArgs): boolean;
  /** Whether ground units can walk at the point, judged by the terrain only. */
  isWalkable({ point }: { point: Point }): boolean;
  /** Whether the target is within range of the unit, collision sizes included. */
  isInRange({ unit, target, range }: WarcraftProbesIsInRangeArgs): boolean;
}
