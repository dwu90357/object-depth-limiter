import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { limitDepth, DEFAULT_SENTINEL, SENTINEL } from '../src/index.js';

describe('limitDepth — argument validation', () => {
  it('throws TypeError for non-integer maxDepth', () => {
    assert.throws(() => limitDepth({ a: 1 }, 1.5), TypeError);
  });

  it('throws TypeError for negative maxDepth', () => {
    assert.throws(() => limitDepth({ a: 1 }, -1), TypeError);
  });

  it('throws TypeError for NaN maxDepth', () => {
    assert.throws(() => limitDepth({ a: 1 }, NaN), TypeError);
  });
});

describe('limitDepth — non-container inputs', () => {
  it('returns primitives unchanged by reference', () => {
    const s = 'hello';
    const n = 42;
    const b = true;
    const u = undefined;
    assert.equal(limitDepth(s, 2), s);
    assert.equal(limitDepth(n, 2), n);
    assert.equal(limitDepth(b, 2), b);
    assert.equal(limitDepth(u, 2), u);
  });

  it('returns null unchanged', () => {
    assert.equal(limitDepth(null, 2), null);
  });

  it('returns Date instances by reference (treated as leaf)', () => {
    const d = new Date('2023-01-01T00:00:00Z');
    assert.equal(limitDepth(d, 2), d);
  });
});

describe('limitDepth — depth semantics', () => {
  it('at maxDepth 0, root is shallow-copied with children replaced by sentinel', () => {
    const input = { a: 1, b: { c: 2 } };
    const out = limitDepth(input, 0);
    // Root is depth 0, which is >= maxDepth 0, so root is shallow-copied.
    // Its children are replaced by the sentinel regardless of their type.
    assert.deepEqual(out, { a: DEFAULT_SENTINEL, b: DEFAULT_SENTINEL });
    // Root itself must be a NEW object, not the same reference.
    assert.notEqual(out, input);
  });

  it('at maxDepth 1, grandchildren are replaced by sentinel', () => {
    const input = { a: { b: { c: { d: 1 } } } };
    const out = limitDepth(input, 1);
    assert.deepEqual(out, { a: { b: DEFAULT_SENTINEL } });
  });

  it('at maxDepth 2, nodes at depth 2 are kept but their children replaced', () => {
    const input = { a: { b: { c: { d: 1 } } } };
    const out = limitDepth(input, 2);
    assert.deepEqual(out, { a: { b: { c: DEFAULT_SENTINEL } } });
  });

  it('preserves all structure within depth with an array at the root', () => {
    const input = [{ x: [{ y: 1 }] }, { z: 2 }];
    const out = limitDepth(input, 2);
    // depth 0: root array (kept, recursed)
    // depth 1: { x: [...] } and { z: 2 } (kept, recursed)
    // depth 2: [ { y: 1 } ] and the primitive 2 — array is kept shallow, 2 stays
    assert.deepEqual(out, [{ x: [DEFAULT_SENTINEL] }, { z: 2 }]);
  });
});

describe('limitDepth — immutability', () => {
  it('does not mutate the input object', () => {
    const input = { a: { b: { c: 1 } } };
    const snapshot = JSON.stringify(input);
    limitDepth(input, 1);
    assert.equal(JSON.stringify(input), snapshot);
  });

  it('does not mutate the input array', () => {
    const input = [{ a: 1 }, { b: 2 }];
    const snapshot = JSON.stringify(input);
    limitDepth(input, 0);
    assert.equal(JSON.stringify(input), snapshot);
  });
});

describe('limitDepth — custom sentinel', () => {
  it('uses a custom string sentinel', () => {
    const out = limitDepth({ a: { b: 1 } }, 0, '__CUT__');
    assert.deepEqual(out, { a: '__CUT__' });
  });

  it('uses null as a sentinel when explicitly provided', () => {
    const out = limitDepth({ a: { b: 1 } }, 0, null);
    assert.deepEqual(out, { a: null });
  });
});

describe('limitDepth — cycle handling', () => {
  it('breaks self-referential cycles by replacing the revisit with the sentinel', () => {
    const a = { name: 'a' };
    a.self = a;
    const out = limitDepth(a, 5);
    // The first encounter of `a` is copied normally; the second (via .self)
    // is detected as a cycle and replaced by the sentinel.
    assert.equal(out.name, 'a');
    assert.equal(out.self, DEFAULT_SENTINEL);
  });

  it('breaks two-node cycles', () => {
    const a = { tag: 'a' };
    const b = { tag: 'b' };
    a.next = b;
    b.next = a;
    const out = limitDepth(a, 5);
    assert.equal(out.tag, 'a');
    assert.equal(out.next.tag, 'b');
    assert.equal(out.next.next, DEFAULT_SENTINEL);
  });
});

describe('limitDepth — exported names', () => {
  it('SENTINEL equals DEFAULT_SENTINEL', () => {
    assert.equal(SENTINEL, DEFAULT_SENTINEL);
  });
});
