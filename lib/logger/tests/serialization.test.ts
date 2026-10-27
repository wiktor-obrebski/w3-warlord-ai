import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { serializeError } from '../json/err-serializer.ts';
import {
  escapeJsonString,
  formatJsonNumber,
  serializeJson,
} from '../json/json.ts';

describe('serializeJson', () => {
  it('matches JSON.stringify for JSON data', () => {
    const values: unknown[] = [
      'plain',
      '',
      0,
      -12.5,
      1e21,
      true,
      false,
      null,
      [],
      {},
      [1, [2, [3]], { a: [] }],
      { nested: { deeper: { list: ['x', null, false] } }, n: 3 },
    ];

    for (const value of values) {
      assert.equal(serializeJson({ value }), JSON.stringify(value));
    }
  });

  it('escapes quotes, backslashes and every control character', () => {
    let allControls = '';
    for (let code = 0; code < 0x20; code++) {
      allControls += String.fromCharCode(code);
    }

    const texts = [
      'say "hi"',
      'C:\\Warcraft III\\Maps',
      'line\nbreak\r\n\ttab',
      allControls,
      '\u001e record separator',
      'del \u007f stays',
      'unicode ąść 日本 🎮',
      '|cffff0000red|r',
    ];

    for (const text of texts) {
      assert.equal(`"${escapeJsonString(text)}"`, JSON.stringify(text));
      assert.equal(JSON.parse(serializeJson({ value: text })), text);
    }
  });

  it('returns the same string when nothing needs escaping', () => {
    const text = 'Worker escaping';

    assert.equal(escapeJsonString(text), text);
  });

  it('writes non-finite numbers as null', () => {
    assert.equal(formatJsonNumber(NaN), 'null');
    assert.equal(formatJsonNumber(Infinity), 'null');
    assert.equal(formatJsonNumber(-Infinity), 'null');
    assert.equal(serializeJson({ value: { n: NaN } }), '{"n":null}');
  });

  it('writes undefined and functions as JSON.stringify does', () => {
    assert.equal(
      serializeJson({ value: { a: undefined, b: () => 1, c: 1 } }),
      '{"c":1}'
    );
    assert.equal(serializeJson({ value: [undefined, () => 1] }), '[null,null]');
  });

  it('marks circular references but repeats shared ones', () => {
    const shared = { id: 1 };
    const cyclic: {
      shared: object;
      again: object;
      self?: object;
      list: object[];
    } = { shared, again: shared, list: [] };
    cyclic.self = cyclic;
    cyclic.list.push(cyclic);

    assert.deepEqual(JSON.parse(serializeJson({ value: cyclic })), {
      shared: { id: 1 },
      again: { id: 1 },
      self: '[Circular]',
      list: ['[Circular]'],
    });
  });

  it('limits depth and breadth like Pino', () => {
    const deep = {
      a: { b: { c: { d: { e: { f: 1 } } } } },
      list: [[[[[[1]]]]]],
    };

    assert.deepEqual(JSON.parse(serializeJson({ value: deep })), {
      a: { b: { c: { d: { e: '[Object]' } } } },
      list: [[[['[Array]']]]],
    });

    const wide = Array.from({ length: 102 }, (_, index) => index);
    const parsedWide = JSON.parse(serializeJson({ value: wide })) as unknown[];
    assert.equal(parsedWide.length, 101);
    assert.equal(parsedWide[100], '... 2 more items');

    const wideObject = Object.fromEntries(
      wide.map((index) => [`k${index}`, index])
    );
    const parsedObject = JSON.parse(
      serializeJson({ value: wideObject })
    ) as Record<string, unknown>;
    assert.equal(Object.keys(parsedObject).length, 101);
    assert.equal(parsedObject['...'], '2 more items');
  });
});

describe('serializeError', () => {
  it('writes type, message, stack and extra properties', () => {
    const error = Object.assign(new RangeError('out of range'), {
      unitId: 7,
      details: { reason: 'blocked' },
    });

    const serialized = serializeError({ error });

    assert.equal(serialized.type, 'RangeError');
    assert.equal(serialized.message, 'out of range');
    assert.equal(serialized.stack, error.stack);
    assert.equal(serialized.unitId, 7);
    assert.deepEqual(serialized.details, { reason: 'blocked' });
    assert.equal('name' in serialized, false);
  });

  it('names subclasses after their constructor', () => {
    class TargetLostError extends Error {}

    assert.equal(
      serializeError({ error: new TargetLostError('gone') }).type,
      'TargetLostError'
    );
  });

  it('appends causes to the message and stack, as Pino does', () => {
    const root = new Error('socket closed');
    const error = new Error('order failed', { cause: root });

    const serialized = serializeError({ error });

    assert.equal(serialized.message, 'order failed: socket closed');
    assert.equal(serialized.stack, `${error.stack}\ncaused by: ${root.stack}`);
    assert.equal('cause' in serialized, false);
  });

  it('keeps a cause that is not an error as a property', () => {
    const error = Object.assign(new Error('failed'), { cause: 'timeout' });

    const serialized = serializeError({ error });

    assert.equal(serialized.message, 'failed');
    assert.equal(serialized.cause, 'timeout');
  });

  it('stops at circular causes', () => {
    const first = new Error('first');
    const second = new Error('second', { cause: first });
    Object.defineProperty(first, 'cause', { value: second });

    const serialized = serializeError({ error: first });

    assert.equal(serialized.message, 'first: second: first: ...');
    assert.match(
      serialized.stack as string,
      /caused by: [\s\S]*causes have become circular\.\.\.$/
    );
  });

  it('omits the stack when no error in the chain has one, as in Warcraft', () => {
    const cause = { message: 'Lua error', stack: '' };
    const error = { message: 'wrapped', name: 'Error', stack: '', cause };

    const serialized = serializeError({ error });

    assert.equal(serialized.message, 'wrapped: Lua error');
    assert.equal('stack' in serialized, false);
  });

  it('serializes nested errors and stops at repeated ones', () => {
    const inner = new Error('inner');
    const outer = Object.assign(new Error('outer'), { inner, again: inner });
    Object.assign(inner, { outer });

    const serialized = serializeError({ error: outer });

    assert.equal((serialized.inner as { message: string }).message, 'inner');
    assert.equal('outer' in (serialized.inner as object), false);
    assert.equal('again' in serialized, false);
  });
});
