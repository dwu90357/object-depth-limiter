/**
 * Object Depth Limiter
 *
 * Recursively copies a plain object/array tree down to a configurable maximum
 * depth, replacing any node at or beyond that depth with a sentinel marker.
 * The original is never mutated.
 */

export { limitDepth } from './core.js';
export { SENTINEL } from './core.js';
export { DEFAULT_SENTINEL } from './core.js';
