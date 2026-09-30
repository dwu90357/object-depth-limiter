# object-depth-limiter

Recursively copies a plain object/array tree down to a configurable maximum depth, replacing any node beyond that depth with a sentinel marker.

```js
import { limitDepth, DEFAULT_SENTINEL } from 'object-depth-limiter';

const deep = { a: { b: { c: { d: 1 } } } };
const safe = limitDepth(deep, 2);
// safe === { a: { b: { c: { '[depth-limited]': true } } } }

// custom marker:
limitDepth(deep, 1, '__CUT__');
// -> { a: { b: '__CUT__' } }
```

Exports: `limitDepth(value, maxDepth, sentinel?)`, `DEFAULT_SENTINEL`, and `SENTINEL` (an alias of `DEFAULT_SENTINEL`).

## Why

Serializers like `JSON.stringify` recurse without a depth bound. Given pathological input — or just a deeply nested record from an upstream service — they will blow the stack. This library produces a bounded-depth copy that is safe to hand to any serializer: the worst case is a tree of height `maxDepth + 1`, no matter what comes in.

The trade-off is that non-plain containers (class instances, `Date`, `Map`, etc.) are treated as leaves and copied by reference. They are not deeply cloned. If you need faithful clones of those, reach for a structured-clone library instead.

## Depth semantics

The root argument is depth 0. At `maxDepth` N, a container at depth N is kept but its children are replaced by the sentinel — recursing into them would reach depth N+1, which is out of bounds. So `limitDepth(x, 0)` returns a shallow copy of the root with every child replaced by the sentinel, and `limitDepth(x, 2)` keeps the root, its children, and its grandchildren, but replaces the great-grandchildren.

Cycles (an object that references itself, directly or indirectly) are broken by replacing the second visit with the sentinel, so the output is always acyclic.

## Awkward edge

`maxDepth` must be a non-negative integer; anything else throws `TypeError`. If you pass `maxDepth` 0 expecting the root to be replaced entirely, that is not what happens — the root is always preserved (shallow-copied), only its children are replaced. If you need the root itself replaced, handle that at the call site.

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

