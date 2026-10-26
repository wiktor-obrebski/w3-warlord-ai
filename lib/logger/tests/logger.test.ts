import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { createLogger, type LoggerOptions } from '../create-logger';
import { createLogRecordBuffer, type LogRecordBuffer } from '../record-buffer';

describe('logger', () => {
  it('writes Pino records with level, time, seq and message', () => {
    const { logger, readRecords } = setUp({ readTime: () => '1793039520000' });

    logger.info('Simple message');

    assert.deepEqual(readRecords(), [
      { level: 30, time: 1793039520000, seq: 1, msg: 'Simple message' },
    ]);
  });

  it('uses Pino level numbers and filters below the minimum level', () => {
    const { logger, readRecords } = setUp({ level: 'trace' });

    logger.trace('t');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    logger.fatal('f');

    assert.deepEqual(
      readRecords().map(({ level }) => level),
      [10, 20, 30, 40, 50, 60]
    );

    const filtered = setUp({ level: 'warn' });
    filtered.logger.debug('d');
    filtered.logger.info('i');
    filtered.logger.warn('w');

    assert.deepEqual(
      filtered.readRecords().map(({ msg }) => msg),
      ['w']
    );
  });

  it('defaults to info and records nothing when silent or disabled', () => {
    const defaults = setUp({});
    defaults.logger.debug('hidden');
    defaults.logger.info('shown');
    assert.deepEqual(
      defaults.readRecords().map(({ msg }) => msg),
      ['shown']
    );

    const silent = setUp({ level: 'silent' });
    silent.logger.fatal('hidden');
    assert.deepEqual(silent.readRecords(), []);

    const disabled = createLogger({ enabled: false });
    disabled.fatal('hidden');
    disabled.child({ component: 'X' }).fatal('hidden');
    assert.equal(disabled.isLevelEnabled('fatal'), false);
  });

  it('reports which levels are enabled', () => {
    const { logger } = setUp({ level: 'debug' });

    assert.equal(logger.level, 'debug');
    assert.equal(logger.isLevelEnabled('trace'), false);
    assert.equal(logger.isLevelEnabled('debug'), true);
    assert.equal(logger.isLevelEnabled('fatal'), true);
    assert.equal(logger.isLevelEnabled('silent'), false);
  });

  it('writes structured fields before the message', () => {
    const { logger, readRecords, readLines } = setUp({});

    logger.info(
      { actorId: 12, ratio: 0.5, escaping: true, target: 'Footman' },
      'Worker escaping'
    );
    logger.warn({ actorId: 3, reason: 'held' });

    assert.deepEqual(readRecords(), [
      {
        level: 30,
        seq: 1,
        actorId: 12,
        ratio: 0.5,
        escaping: true,
        target: 'Footman',
        msg: 'Worker escaping',
      },
      { level: 40, seq: 2, actorId: 3, reason: 'held' },
    ]);
    assert.match(readLines()[0] ?? '', /"target":"Footman","msg":/);
  });

  it('serializes arrays, nested objects and null, and skips undefined and functions', () => {
    const { logger, readRecords } = setUp({});

    logger.info({
      units: [1, 'two', { three: 3 }],
      position: { x: 1.5, y: -2 },
      empty: null,
      missing: undefined,
      callback: () => 1,
    });

    assert.deepEqual(readRecords(), [
      {
        level: 30,
        seq: 1,
        units: [1, 'two', { three: 3 }],
        position: { x: 1.5, y: -2 },
        empty: null,
      },
    ]);
  });

  it('captures fields as they were when logged', () => {
    const { logger, readRecords } = setUp({});
    const position = { x: 1, y: 2 };
    const path = [position];
    const fields = { position, path, count: 1 };

    logger.info(fields, 'Moved');
    position.x = 99;
    path.push({ x: 3, y: 4 });
    fields.count = 2;

    assert.deepEqual(readRecords()[0], {
      level: 30,
      seq: 1,
      position: { x: 1, y: 2 },
      path: [{ x: 1, y: 2 }],
      count: 1,
      msg: 'Moved',
    });
  });

  it('adds child bindings after the parent bindings, in order', () => {
    const { logger, readRecords } = setUp({});
    const workerSafety = logger.child({ component: 'WorkerSafety' });
    const escape = workerSafety.child({ plan: 'Escape', depth: 2 });

    workerSafety.info({ actorId: 12 }, 'Worker escaping');
    escape.debug('hidden by the inherited level');
    escape.warn({ actorId: 12 }, 'Escape failed');
    logger.info('root');

    assert.deepEqual(readRecords(), [
      {
        level: 30,
        seq: 1,
        component: 'WorkerSafety',
        actorId: 12,
        msg: 'Worker escaping',
      },
      {
        level: 40,
        seq: 2,
        component: 'WorkerSafety',
        plan: 'Escape',
        depth: 2,
        actorId: 12,
        msg: 'Escape failed',
      },
      { level: 30, seq: 3, msg: 'root' },
    ]);
  });

  it('captures child bindings when the child is created', () => {
    const { logger, readRecords } = setUp({});
    const bindings = { component: 'Before', tags: ['a'] };
    const child = logger.child(bindings);

    bindings.component = 'After';
    bindings.tags.push('b');
    child.info('x');

    assert.deepEqual(readRecords()[0], {
      level: 30,
      seq: 1,
      component: 'Before',
      tags: ['a'],
      msg: 'x',
    });
  });

  it('adds mixin fields to every record, before the call fields', () => {
    let gameTime = 38.75;
    const { logger, readLines } = setUp({
      mixin: () => ({ gameTime, tick: gameTime * 10 }),
    });
    const child = logger.child({ component: 'WorkerSafety' });

    child.info({ actorId: 12 }, 'Worker escaping');
    gameTime = 40;
    logger.info('later');

    assert.deepEqual(readLines(), [
      '{"level":30,"seq":1,"component":"WorkerSafety","gameTime":38.75,"tick":387.5,"actorId":12,"msg":"Worker escaping"}',
      '{"level":30,"seq":2,"gameTime":40,"tick":400,"msg":"later"}',
    ]);
  });

  it('omits time while the clock has no reading', () => {
    let time: string | undefined;
    const { logger, readRecords } = setUp({ readTime: () => time });

    logger.info('no clock');
    time = '5';
    logger.info('clock');

    assert.deepEqual(
      readRecords().map((record) => record.time),
      [undefined, 5]
    );
  });

  it('writes time text as given, beyond what 32-bit Lua numbers hold', () => {
    const { logger, readLines } = setUp({ readTime: () => '1793048829123' });

    logger.info('x');

    assert.equal(
      readLines()[0],
      '{"level":30,"time":1793048829123,"seq":1,"msg":"x"}'
    );
  });

  it('records an error passed in place of fields as err, with its message', () => {
    const { logger, readRecords } = setUp({});
    const error = new TypeError('bad target');

    logger.error(error);
    logger.error(error, 'Explained');

    const [first, second] = readRecords() as [
      { msg: string; err: { stack: string } },
      { msg: string },
    ];
    const { stack, ...errWithoutStack } = first.err;
    assert.equal(first.msg, 'bad target');
    assert.equal(second.msg, 'Explained');
    assert.deepEqual(errWithoutStack, {
      type: 'TypeError',
      message: 'bad target',
    });
    assert.match(stack, /^TypeError: bad target\n/);
  });

  it('takes the message of an err field when the call has none', () => {
    const { logger, readRecords } = setUp({});

    logger.error({ err: new Error('lost'), component: 'Runtime' });
    logger.error({ err: new Error('lost'), msg: 'own' });
    logger.error({ err: 'a Lua error string' });

    assert.deepEqual(
      readRecords().map(({ msg }) => msg),
      ['lost', 'own', undefined]
    );
  });

  it('serializes errors under other keys too', () => {
    const { logger, readRecords } = setUp({});

    logger.error({ error: new Error('Unexpected failure'), component: 'X' });

    const record = readRecords()[0]!;
    assert.equal((record.error as { type: string }).type, 'Error');
    assert.equal(
      (record.error as { message: string }).message,
      'Unexpected failure'
    );
  });

  it('records circular references instead of failing', () => {
    const { logger, readRecords } = setUp({});
    const node: { name: string; self?: unknown } = { name: 'loop' };
    node.self = node;

    logger.info({ node }, 'Circular');

    assert.deepEqual(readRecords()[0]?.node, {
      name: 'loop',
      self: '[Circular]',
    });
  });

  it('never throws when a field cannot be read', () => {
    const { logger, readRecords } = setUp({});
    const hostile = {
      get broken() {
        throw new Error('getter failed');
      },
    };

    logger.info({ hostile }, 'Survives');

    assert.deepEqual(readRecords()[0], {
      level: 30,
      seq: 1,
      hostile: '[Unserializable: Error: getter failed]',
      msg: 'Survives',
    });
  });
});

interface SetUpArgs {
  level?: Extract<LoggerOptions, { buffer: LogRecordBuffer }>['level'];
  readTime?: () => string | undefined;
  mixin?: () => Record<string, unknown>;
}

function setUp({ level, readTime, mixin }: SetUpArgs) {
  const buffer = createLogRecordBuffer({ capacity: 100 });
  const logger = createLogger({ level, buffer, readTime, mixin });
  let drained: string[] | undefined;

  const readLines = () => {
    drained ??= buffer
      .drain({ maxRecords: 100 })
      .jsonl.split('\n')
      .filter((line) => line !== '');
    return drained;
  };

  const readRecords = () =>
    readLines().map((line) => JSON.parse(line) as Record<string, unknown>);

  return { logger, readLines, readRecords };
}
