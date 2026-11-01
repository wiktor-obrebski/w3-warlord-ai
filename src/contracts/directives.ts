import type { Point } from '@lib/math';
import type { UnitId } from './ids';
import type { OrderTarget } from './orders';

export {
  type Task,
  type MoveTask,
  type HoldTask,
  type HarvestTask,
  type BuildTask,
  type RepairTask,
  type ProduceTask,
  type RallyTask,
  type UseAbilityTask,
  type Directive,
};

/**
 * What a unit is asked to do, from a closed vocabulary. Most tasks last: the
 * unit is ordered once, unless it already carries the task out, and the task
 * ends once the unit stops carrying it out. Produce, Rally, and UseAbility
 * take a single order.
 */
type Task =
  | MoveTask
  | HoldTask
  | HarvestTask
  | BuildTask
  | RepairTask
  | ProduceTask
  | RallyTask
  | UseAbilityTask;

interface MoveTask {
  readonly kind: 'Move';
  readonly point: Point;
}

interface HoldTask {
  readonly kind: 'Hold';
}

interface HarvestTask {
  readonly kind: 'Harvest';
  readonly harvestTarget: OrderTarget;
}

interface BuildTask {
  readonly kind: 'Build';
  // The rawcode of the building.
  readonly building: number;
  readonly point: Point;
}

interface RepairTask {
  readonly kind: 'Repair';
  readonly repairTarget: UnitId;
}

/** Trains a unit, or upgrades a building, of the type. */
interface ProduceTask {
  readonly kind: 'Produce';
  // The rawcode of the unit type.
  readonly unitType: number;
  // Where the produced unit goes; the rally is pointed there first.
  readonly rallyTarget?: OrderTarget;
}

interface RallyTask {
  readonly kind: 'Rally';
  readonly rallyTarget: OrderTarget;
}

/** Uses an ability that needs no target, such as Call to Arms. */
interface UseAbilityTask {
  readonly kind: 'UseAbility';
  readonly orderString: string;
}

/**
 * What a unit's owner asks of it, and why. Its status follows its task: a
 * lasting task is pending until its unit is first seen carrying it out,
 * underway while it does, and done once it stops; a single-order task is
 * done once ordered. A Directive fails when its order is refused. An
 * unfinished one is pending again while a reflex has taken its unit over,
 * and starts anew once the reflex lets go.
 */
interface Directive {
  readonly unit: UnitId;
  readonly task: Task;
  readonly reason: string;
}
