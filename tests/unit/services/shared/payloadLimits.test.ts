import { describe, expect, it } from 'vitest';

import { exceedsMaxNestingDepth, MAX_PAYLOAD_NESTING_DEPTH } from '@/services/shared/payloadLimits';

/**
 * 06_TASKS.md M9-032 ("Audit Import Security"), "Deeply nested data" —
 * see `payloadLimits.ts`'s own header comment for the crash this guards
 * against (an unbounded `findSensitiveField` recursion) and why this
 * check's own recursion is self-bounding by construction.
 */
function buildNestedObject(depth: number): unknown {
  let value: unknown = 'leaf';
  for (let i = 0; i < depth; i += 1) {
    value = { nested: value };
  }
  return value;
}

describe('exceedsMaxNestingDepth', () => {
  it('accepts shallow, realistic payload shapes', () => {
    const payload = {
      result: { strategy: { steps: [{ collateralAfter: { quantity: 2.02 } }] } },
    };
    expect(exceedsMaxNestingDepth(payload)).toBe(false);
  });

  it('accepts a payload nested exactly at the limit', () => {
    expect(exceedsMaxNestingDepth(buildNestedObject(MAX_PAYLOAD_NESTING_DEPTH))).toBe(false);
  });

  it('rejects a payload nested one level beyond the limit', () => {
    expect(exceedsMaxNestingDepth(buildNestedObject(MAX_PAYLOAD_NESTING_DEPTH + 1))).toBe(true);
  });

  it('rejects a pathologically deep payload without overflowing the call stack', () => {
    expect(() => exceedsMaxNestingDepth(buildNestedObject(100_000))).not.toThrow();
    expect(exceedsMaxNestingDepth(buildNestedObject(100_000))).toBe(true);
  });

  it('scans arrays with the same depth accounting as objects', () => {
    let value: unknown = 'leaf';
    for (let i = 0; i < MAX_PAYLOAD_NESTING_DEPTH + 1; i += 1) {
      value = [value];
    }
    expect(exceedsMaxNestingDepth(value)).toBe(true);
  });

  it('does not flag primitives or null', () => {
    expect(exceedsMaxNestingDepth('a string')).toBe(false);
    expect(exceedsMaxNestingDepth(42)).toBe(false);
    expect(exceedsMaxNestingDepth(null)).toBe(false);
    expect(exceedsMaxNestingDepth(undefined)).toBe(false);
  });
});
