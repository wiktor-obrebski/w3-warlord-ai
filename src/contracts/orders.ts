import type { Point } from '@lib/math';
import type { DestructableId, UnitId } from './ids';

export {
  type Order,
  type OrderTarget,
  type OrderTicket,
  type TicketedOrder,
  type OrderQueue,
};

/**
 * An order for the order executor to issue, and why. The shapes follow
 * Warcraft's own order natives.
 */
type Order =
  | ImmediateOrder
  | ImmediateOrderById
  | PointOrder
  | TargetOrder
  | BuildOrder;

interface ImmediateOrder {
  readonly kind: 'immediate';
  readonly unit: UnitId;
  readonly orderString: string;
  readonly reason: string;
}

// Training, upgrading, and other orders Warcraft identifies by a rawcode.
interface ImmediateOrderById {
  readonly kind: 'immediateById';
  readonly unit: UnitId;
  readonly orderId: number;
  readonly reason: string;
}

interface PointOrder {
  readonly kind: 'point';
  readonly unit: UnitId;
  readonly orderString: string;
  readonly point: Point;
  readonly reason: string;
}

interface TargetOrder {
  readonly kind: 'target';
  readonly unit: UnitId;
  readonly orderString: string;
  readonly target: OrderTarget;
  readonly reason: string;
}

interface BuildOrder {
  readonly kind: 'build';
  readonly unit: UnitId;
  // The rawcode of the building.
  readonly building: number;
  readonly point: Point;
  readonly reason: string;
}

type OrderTarget =
  | { readonly unit: UnitId }
  | { readonly destructable: DestructableId };

/** Identifies an order of one step, so its refusal can be reported back. */
type OrderTicket = number & { readonly __orderTicket: never };

interface TicketedOrder {
  readonly ticket: OrderTicket;
  readonly order: Order;
}

interface OrderQueueQueueArgs {
  order: Order;
  // Runs at the start of the next step if Warcraft refused the order.
  onRefused?: () => void;
}

/**
 * Collects the orders of the step being run; the order executor issues them
 * once the step ends.
 */
interface OrderQueue {
  queue({ order, onRefused }: OrderQueueQueueArgs): void;
}
