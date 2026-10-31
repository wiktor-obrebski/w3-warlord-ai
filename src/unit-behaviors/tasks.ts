import type { Beliefs } from '../contracts/beliefs';
import type { Task } from '../contracts/directives';
import type { UnitId } from '../contracts/ids';
import type { Order, OrderTarget } from '../contracts/orders';
import type { OwnUnit } from '../contracts/world';

export { isLasting, carriesOut, orderFor, sameTask, sameTarget };

/** Whether the task lasts, rather than taking a single order. */
function isLasting({ task }: { task: Task }): boolean {
  return (
    task.kind !== 'Produce' &&
    task.kind !== 'Rally' &&
    task.kind !== 'UseAbility'
  );
}

interface CarriesOutArgs {
  task: Task;
  ownUnit: OwnUnit;
  beliefs: Beliefs;
}

/**
 * Whether the unit is carrying out the lasting task, as far as it shows: an
 * order's target cannot be read back, so a unit moving anywhere carries out
 * any Move.
 */
function carriesOut({ task, ownUnit, beliefs }: CarriesOutArgs): boolean {
  const { self } = beliefs;
  const { unit } = ownUnit;

  switch (task.kind) {
    case 'Move':
      return self.movingUnits.includes(unit);
    case 'Hold':
      return self.holdingPositionUnits.includes(unit);
    case 'Harvest':
      return self.harvestingUnits.includes(unit);
    case 'Build':
      return ownUnit.order === task.building;
    case 'Repair':
      return self.repairingUnits.includes(unit);
    case 'Produce':
    case 'Rally':
    case 'UseAbility':
      return false;
  }
}

interface OrderForArgs {
  task: Task;
  unit: UnitId;
  reason: string;
}

/** The order that starts the task. */
function orderFor({ task, unit, reason }: OrderForArgs): Order {
  switch (task.kind) {
    case 'Move':
      return {
        kind: 'point',
        unit,
        orderString: 'move',
        point: task.point,
        reason,
      };
    case 'Hold':
      return { kind: 'immediate', unit, orderString: 'holdposition', reason };
    case 'Harvest':
      return {
        kind: 'target',
        unit,
        orderString: 'harvest',
        target: task.harvestTarget,
        reason,
      };
    case 'Build':
      return {
        kind: 'build',
        unit,
        building: task.building,
        point: task.point,
        reason,
      };
    case 'Repair':
      return {
        kind: 'target',
        unit,
        orderString: 'repair',
        target: { unit: task.repairTarget },
        reason,
      };
    case 'Produce':
      return { kind: 'immediateById', unit, orderId: task.unitType, reason };
    case 'Rally':
      return {
        kind: 'target',
        unit,
        orderString: 'setrally',
        target: task.rallyTarget,
        reason,
      };
    case 'UseAbility':
      return { kind: 'immediate', unit, orderString: task.orderString, reason };
  }
}

interface SameTaskArgs {
  a: Task;
  b: Task;
}

/** Whether two tasks ask for the same thing. */
function sameTask({ a, b }: SameTaskArgs): boolean {
  switch (a.kind) {
    case 'Move':
      return (
        b.kind === 'Move' && a.point.x === b.point.x && a.point.y === b.point.y
      );
    case 'Hold':
      return b.kind === 'Hold';
    case 'Harvest':
      return (
        b.kind === 'Harvest' &&
        sameTarget({ a: a.harvestTarget, b: b.harvestTarget })
      );
    case 'Build':
      return (
        b.kind === 'Build' &&
        a.building === b.building &&
        a.point.x === b.point.x &&
        a.point.y === b.point.y
      );
    case 'Repair':
      return b.kind === 'Repair' && a.repairTarget === b.repairTarget;
    case 'Produce':
      return (
        b.kind === 'Produce' &&
        a.unitType === b.unitType &&
        (a.rallyTarget === undefined || b.rallyTarget === undefined
          ? a.rallyTarget === b.rallyTarget
          : sameTarget({ a: a.rallyTarget, b: b.rallyTarget }))
      );
    case 'Rally':
      return (
        b.kind === 'Rally' && sameTarget({ a: a.rallyTarget, b: b.rallyTarget })
      );
    case 'UseAbility':
      return b.kind === 'UseAbility' && a.orderString === b.orderString;
  }
}

interface SameTargetArgs {
  a: OrderTarget;
  b: OrderTarget;
}

function sameTarget({ a, b }: SameTargetArgs): boolean {
  return 'unit' in a
    ? 'unit' in b && a.unit === b.unit
    : 'destructable' in b && a.destructable === b.destructable;
}
