import * as W3UnitApi from '@lib/warcraft3-api/unit';
import * as W3DestructableApi from '@lib/warcraft3-api/destructable';
import type {
  Order,
  OrderTarget,
  OrderTicket,
  TicketedOrder,
} from '../contracts/orders';
import type { Perception } from './perception';

export { type OrderExecutor, createOrderExecutor };

interface OrderExecutorExecuteArgs {
  orders: readonly TicketedOrder[];
}

/** The only code issuing the mind's orders to Warcraft. */
interface OrderExecutor {
  /** Issues the orders in turn, and returns those Warcraft refused. */
  execute({ orders }: OrderExecutorExecuteArgs): {
    refusedOrders: readonly OrderTicket[];
  };
}

function createOrderExecutor({
  perception,
}: {
  perception: Perception;
}): OrderExecutor {
  return {
    execute({ orders }) {
      const refusedOrders: OrderTicket[] = [];

      for (const { ticket, order } of orders) {
        if (!issue({ order, perception })) {
          refusedOrders.push(ticket);
        }
      }

      return { refusedOrders };
    },
  };
}

interface IssueArgs {
  order: Order;
  perception: Perception;
}

// An order for a unit or a target that no longer exists counts as refused,
// as Warcraft would refuse it.
function issue({ order, perception }: IssueArgs): boolean {
  const unit = perception.unitIds.handleOf({ id: order.unit });

  if (!unit) {
    return false;
  }

  switch (order.kind) {
    case 'immediate':
      return W3UnitApi.IssueImmediateOrder(unit, order.orderString);

    case 'immediateById':
      return W3UnitApi.IssueImmediateOrderById(unit, order.orderId);

    case 'point':
      return W3UnitApi.IssuePointOrder(
        unit,
        order.orderString,
        order.point.x,
        order.point.y
      );

    case 'target': {
      const target = targetOf({ target: order.target, perception });

      return (
        target !== undefined &&
        W3UnitApi.IssueTargetOrder(unit, order.orderString, target)
      );
    }

    case 'build':
      return W3UnitApi.IssueBuildOrderById(
        unit,
        order.building,
        order.point.x,
        order.point.y
      );
  }
}

interface TargetOfArgs {
  target: OrderTarget;
  perception: Perception;
}

function targetOf({
  target,
  perception,
}: TargetOfArgs): W3UnitApi.unit | W3DestructableApi.destructable | undefined {
  return 'unit' in target
    ? perception.unitIds.handleOf({ id: target.unit })
    : perception.destructableIds.handleOf({ id: target.destructable });
}
