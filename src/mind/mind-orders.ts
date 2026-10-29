import type { UnitId } from '../contracts/ids';
import type {
  Order,
  OrderQueue,
  OrderTicket,
  TicketedOrder,
} from '../contracts/orders';
import type { WarcraftProbes } from '../contracts/probes';
import type { DecisionRecorder } from '../contracts/record';

export { type MindOrders, createMindOrders };

interface MindOrdersStartStepArgs {
  refusedOrders: readonly OrderTicket[];
}

/** The orders the mind gives during one step, and what follows a refusal. */
interface MindOrders {
  readonly queue: OrderQueue;
  /**
   * The probes, guarded: a probe orders its unit at once, so it would
   * overtake an order already queued for that unit this step, which the
   * executor issues only after the step.
   */
  readonly probes: WarcraftProbes;
  /**
   * Notes the previous step's refused orders and runs their handlers. The
   * orders of a step that failed before handing them over are dropped, so
   * they are never issued late.
   */
  startStep({ refusedOrders }: MindOrdersStartStepArgs): void;
  /** Takes the step's orders; their refusals arrive with the next step. */
  takeOrders(): readonly TicketedOrder[];
}

interface CreateMindOrdersArgs {
  probes: WarcraftProbes;
  recorder: DecisionRecorder;
}

function createMindOrders({
  probes,
  recorder,
}: CreateMindOrdersArgs): MindOrders {
  let queued: QueuedOrder[] = [];
  // The orders of the previous step, in ticket order.
  let issued: QueuedOrder[] = [];

  const assertNothingQueuedFor = ({ unit }: { unit: UnitId }) => {
    const overtaken = queued.find(({ order }) => order.unit === unit);

    if (overtaken) {
      throw new Error(
        `Mind orders: a probe would overtake the order queued for unit ${unit} (${overtaken.order.reason}).`
      );
    }
  };

  return {
    queue: {
      queue({ order, onRefused }) {
        queued.push({ order, onRefused });
      },
    },

    probes: {
      tryBuild(args) {
        assertNothingQueuedFor({ unit: args.unit });
        return probes.tryBuild(args);
      },

      tryHarvest(args) {
        assertNothingQueuedFor({ unit: args.unit });
        return probes.tryHarvest(args);
      },

      tryAttack(args) {
        assertNothingQueuedFor({ unit: args.unit });
        return probes.tryAttack(args);
      },

      isWalkable(args) {
        return probes.isWalkable(args);
      },

      isInRange(args) {
        return probes.isInRange(args);
      },
    },

    startStep({ refusedOrders }) {
      for (const ticket of refusedOrders) {
        const refused = issued[ticket - 1];

        if (!refused) {
          throw new Error(
            `Mind orders: refused order ${ticket} was not issued in the previous step.`
          );
        }

        recorder.note({
          message: `Order refused (${refused.order.reason}).`,
          fields: { unit: refused.order.unit },
        });
        refused.onRefused?.();
      }

      issued = [];
      queued = [];
    },

    takeOrders() {
      issued = queued;
      queued = [];

      return issued.map((queuedOrder, index) => ({
        ticket: (index + 1) as OrderTicket,
        order: queuedOrder.order,
      }));
    },
  };
}

interface QueuedOrder {
  readonly order: Order;
  readonly onRefused?: () => void;
}
