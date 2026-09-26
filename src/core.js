/**
 * Core implementation for depth-limiting object copies.
 *
 * Design decisions (stated plainly so the reader knows what they are getting):
 *
 * 1. Only plain objects ({}) and arrays ([]) are recursed into. Anything that
 *    isn't one of those — dates, regexps, maps, class instances, functions —
 *    is treated as a leaf and copied by reference. We do not try to clone
 *    every built-in; that is a different library.
 *
 * 2. Depth is measured against the root argument as depth 0. With maxDepth 2,
 *    the root's own children are depth 1, their children are depth 2, and any
 *    object/array AT depth 2 (i.e. the grandchildren of the root) is kept
 *    intact. It is the great-grandchildren — the contents of those depth-2
 *    nodes — that get replaced by the sentinel. In other words, we replace a
 *    node when recursing into it would exceed maxDepth. This means the root is
 *    never replaced, even at maxDepth 0, because the root itself is not the
 *    result of a recursive step.
 *
 * 3. Cycles are handled by a WeakMap of seen objects. If we revisit an object
 *    we already copied, we replace it with the sentinel rather than following
 *    it again. This prevents infinite loops without throwing.
 *
 * 4. The sentinel defaults to { '[depth-limited]': true } but can be any value
 *    the caller supplies (including null). It is shared by reference across all
 *    replacement sites; callers who mutate it do so at their own risk.
 */

/**
 * Default sentinel value. A plain object so it serializes cleanly to JSON.
 * Reused by reference everywhere a node is replaced.
 */
export const DEFAULT_SENTINEL = { '[depth-limited]': true };

/**
 * Same value as DEFAULT_SENTINEL, exported under a shorter name.
 */
export const SENTINEL = DEFAULT_SENTINEL;

/**
 * Returns true for values we recurse into: plain objects and arrays.
 *
 * We check the prototype explicitly rather than using `typeof` alone, because
 * `typeof new Date()` is 'object' but Date instances are not plain containers
 * and should be copied as leaves. Class instances likewise carry their own
 * semantics and are left alone.
 */
function isPlainContainer(value) {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  // Arrays are containers.
  if (Array.isArray(value)) {
    return true;
  }
  // Plain objects only: prototype must be Object.prototype (or null).
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Internal recursive worker.
 *
 * @param {*} value - The current node.
 * @param {number} depth - Depth of value within the original tree. Root = 0.
 * @param {number} maxDepth - Inclusive maximum depth for containers.
 * @param {*} sentinel - Value to substitute when depth is exceeded.
 * @param {WeakMap<object, boolean>} seen - Tracks objects already copied, to
 *   break cycles. The value is just a placeholder; only presence matters.
 * @returns {*} The limited copy.
 */
function worker(value, depth, maxDepth, sentinel, seen) {
  if (!isPlainContainer(value)) {
    return value;
  }

  // Cycle guard: if we've already entered this object, don't follow it again.
  if (seen.has(value)) {
    return sentinel;
  }
  seen.set(value, true);

  try {
    // If this node is at maxDepth, we keep the node but replace its children
    // with the sentinel — i.e. we do NOT recurse further into its contents.
    // We still shallow-copy the node itself so callers see the right shape.
    if (depth >= maxDepth) {
      // Shallow copy: children are replaced by sentinel, preserving keys.
      if (Array.isArray(value)) {
        return value.map(() => sentinel);
      }
      const out = {};
      for (const key of Object.keys(value)) {
        out[key] = sentinel;
      }
      return out;
    }

    // depth < maxDepth: recurse into children at depth + 1.
    if (Array.isArray(value)) {
      return value.map((item) => worker(item, depth + 1, maxDepth, sentinel, seen));
    }

    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = worker(value[key], depth + 1, maxDepth, sentinel, seen);
    }
    return out;
  } finally {
    // Remove so the same object can appear in disjoint subtrees without
    // being flagged as a cycle. (Not strictly necessary for correctness
    // given that we return fresh copies, but keeps the map bounded.)
    seen.delete(value);
  }
}

/**
 * Copy an object/array tree down to a maximum depth, replacing deeper nodes
 * with a sentinel.
 *
 * @param {*} value - The value to copy. Non-container values are returned
 *   unchanged by reference.
 * @param {number} maxDepth - Maximum depth of containers to preserve. The root
 *   is depth 0. Must be a non-negative integer.
 * @param {*} [sentinel=DEFAULT_SENTINEL] - Value substituted for nodes beyond
 *   maxDepth. May be any value, including null.
 * @returns {*} A new value with the same shape down to maxDepth.
 * @throws {TypeError} If maxDepth is not a non-negative integer.
 */
export function limitDepth(value, maxDepth, sentinel = DEFAULT_SENTINEL) {
  if (!Number.isInteger(maxDepth) || maxDepth < 0) {
    throw new TypeError(
      `maxDepth must be a non-negative integer, got ${String(maxDepth)}`
    );
  }
  // Fresh seen-map per top-level call so disjoint calls don't interfere.
  return worker(value, 0, maxDepth, sentinel, new WeakMap());
}
