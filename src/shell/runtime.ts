import * as W3MathApi from '@lib/warcraft3-api/math';
import * as W3PlayerApi from '@lib/warcraft3-api/player';
import * as W3TimerApi from '@lib/warcraft3-api/timer';
import * as WarlordApi from '@lib/warcraft3-api/warlord';
import type { Logger } from '@lib/logger';
import { SEEDED_RANDOM_MAX_SEED, createSeededRandom } from '@lib/math';
import type { OrderTicket, TicketedOrder } from '../contracts/orders';
import type { DecisionRecord } from '../contracts/record';
import { createMind } from '../mind/mind';
import { debug } from './debug';
import { createOrderExecutor } from './order-executor';
import { createPerception } from './perception';
import { createWarcraftProbes } from './warcraft-probes';

export { startRuntime };

const TickSeconds = 0.1;

interface StartRuntimeArgs {
  bot: W3PlayerApi.player;
  logger: Logger;
  recordLogger: Logger;
}

/**
 * Runs the bot for one player, from the first tick until the game is won.
 *
 * Each tick Perception observes the game, the mind decides, and the order
 * executor issues the mind's orders; the orders Warcraft refuses reach the
 * mind with the next tick's observations. The tick's decision record is
 * shown in-game and written to its log.
 */
function startRuntime({ bot, logger, recordLogger }: StartRuntimeArgs) {
  const log = logger.child({ component: 'Runtime' });
  const perception = createPerception({ bot });
  const executor = createOrderExecutor({ perception });
  const mind = createMind({
    knowledge: {},
    // Warcraft's own generator is synchronized between players, so seeding
    // from it keeps multiplayer games in sync; the wall clock would not.
    random: createSeededRandom({
      seed: W3MathApi.GetRandomInt(1, SEEDED_RANDOM_MAX_SEED),
    }),
    probes: createWarcraftProbes({ perception }),
    tickSeconds: TickSeconds,
  });
  const loop = W3TimerApi.CreateTimer();
  let refusedOrders: readonly OrderTicket[] = [];

  const tick = () => {
    const observations = perception.observe({ refusedOrders });

    // Delivered once: if the step fails, the next one must not get them again.
    refusedOrders = [];

    if (observations.world.enemy.playersPlaying === 0) {
      stopLoop({ loop, log });
      return;
    }

    const { orders, record } = mind.step({ observations });

    ({ refusedOrders } = executor.execute({ orders }));
    writeRecord({ record, orders, recordLogger });
  };

  W3TimerApi.TimerStart(loop, TickSeconds, true, WarlordApi.guard(tick));
  tick();
}

interface StopLoopArgs {
  loop: W3TimerApi.timer;
  log: Logger;
}

// With every enemy defeated there is nothing left to play for, and the
// tower rush cannot run without an enemy.
function stopLoop({ loop, log }: StopLoopArgs) {
  W3TimerApi.PauseTimer(loop);
  W3TimerApi.DestroyTimer(loop);
  debug({ message: 'Game won; Warlord AI stops.' });
  log.info('Game won; Warlord AI stops');
}

interface WriteRecordArgs {
  record: DecisionRecord;
  orders: readonly TicketedOrder[];
  recordLogger: Logger;
}

function writeRecord({ record, orders, recordLogger }: WriteRecordArgs) {
  for (const { message, fields } of record.notes) {
    debug({ message });
    recordLogger.info(fields ?? {}, message);
  }

  for (const { order } of orders) {
    recordLogger.debug({ unit: order.unit }, `Order: ${order.reason}`);
  }
}
