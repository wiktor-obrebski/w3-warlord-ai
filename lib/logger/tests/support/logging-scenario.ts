import { createLogger, type Logger } from '../../create-logger';
import type { LogTransport } from '../../log-transport';

export { logScenario };

/**
 * Logs the scenario at `debug` level into `transport`, in batches of 10,
 * flushing until nothing is left, including the flush reports. Portable,
 * so Node and Lua write records that can be compared.
 */
function logScenario({ transport }: { transport: LogTransport }) {
  let batchesWritten = 0;
  let gameTime = 0;
  const logger = createLogger({
    level: 'debug',
    transport: {
      write({ batch }) {
        batchesWritten += 1;
        transport.write({ batch });
      },
    },
    bufferCapacity: 1000,
    batchSize: 10,
    readTime: () => '1793039520000',
    mixin: () => {
      gameTime += 0.25;
      return { gameTime };
    },
  });

  runLoggingScenario({ logger });

  for (let before = -1; before !== batchesWritten;) {
    before = batchesWritten;
    logger.flush();
  }
}

/**
 * Log calls exercising every kind of value. Avoids what the two runtimes
 * write differently by design: `null`, empty objects, stack traces, and
 * numbers needing more than 14 significant digits.
 */
function runLoggingScenario({ logger }: { logger: Logger }) {
  const workerSafety = logger.child({ component: 'WorkerSafety', bot: 1 });

  logger.info('Simple message');
  logger.trace({ unitId: 1 }, 'Below the level');
  logger.debug({ intention: 'TowerRush' }, 'Intention activated');
  logger.info(
    { from: 'Economy', to: 'WorkerSafety', actorId: 12 },
    'Actor control transferred'
  );
  workerSafety.warn(
    { actorId: 12, reason: 'held by "Defense"' },
    'Command rejected'
  );
  workerSafety.info(
    {
      position: { x: -1250.5, y: 3072 },
      path: [1, 2.25, 'three', true, [4]],
      ratio: 0.125,
      large: 4294967296,
      negative: -7,
      flags: { attacked: true, fleeing: false },
    },
    'Worker escaping'
  );
  workerSafety.info(
    {
      text: 'quotes " backslash \\ tab \t newline \n bell \u0007 unicode ąść 日本 🎮',
    },
    'Escaping'
  );
  workerSafety.info(
    { long: 'é'.repeat(300) },
    'Longer than one Preload argument'
  );

  const cyclic: { name: string; self?: unknown } = { name: 'cycle' };
  cyclic.self = cyclic;
  logger.info({ cyclic }, 'Circular');

  const cause = new TypeError('target destroyed');
  const error = new Error('order failed');
  (error as { cause?: unknown }).cause = cause;
  (error as { orderId?: unknown }).orderId = 851983;
  logger.error({ err: error, component: 'Runtime' });
  logger.fatal(new RangeError('Unrecoverable error'));
  logger.error({ err: 'Lua runtime error string' }, 'Lua error');

  for (let index = 0; index < 20; index++) {
    workerSafety.debug({ index }, 'Repeated');
  }
}
