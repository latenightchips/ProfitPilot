import { describe, expect, it } from 'vitest';

import { toJsonSafe } from '@/app/api/aave/_shared/toJsonSafe';

/**
 * `toJsonSafe`'s own isolated tests — the generic recursive bigint->string
 * converter each V4 route applies to `result.data` at the response
 * boundary. See `./toJsonSafe.ts`'s own header comment for why this
 * exists: `NextResponse.json()` throws `TypeError: Do not know how to
 * serialize a BigInt` the instant any bigint appears anywhere in the
 * object graph it's given, and V4's snapshot types (unlike V3's) carry a
 * `raw` layer with genuine on-chain bigints.
 */
describe('toJsonSafe', () => {
  it('converts a top-level bigint to its decimal string representation', () => {
    expect(toJsonSafe(123n)).toBe('123');
  });

  it('converts bigints nested inside an array', () => {
    expect(toJsonSafe([1n, 2n, 3n])).toEqual(['1', '2', '3']);
  });

  it('converts bigints nested arbitrarily deep inside an object, including a field literally named dynamicReserveConfig', () => {
    const input = {
      raw: {
        blockNumber: 21_000_000n,
        dynamicReserveConfig: {
          collateralFactor: 8000n,
        },
      },
    };
    expect(toJsonSafe(input)).toEqual({
      raw: {
        blockNumber: '21000000',
        dynamicReserveConfig: {
          collateralFactor: '8000',
        },
      },
    });
  });

  it('leaves non-bigint primitives (number, string, boolean, null) unchanged', () => {
    const input = { a: 1, b: 'text', c: true, d: null };
    expect(toJsonSafe(input)).toEqual({ a: 1, b: 'text', c: true, d: null });
  });

  it('preserves every key and the overall object shape — no fields are dropped', () => {
    const input = {
      raw: { blockNumber: 1n, spoke: '0xabc' as const },
      canonical: { collateralPriceUsd: 64000 },
      display: { network: 'ethereum' },
    };
    expect(Object.keys(toJsonSafe(input))).toEqual(['raw', 'canonical', 'display']);
    expect(Object.keys(toJsonSafe(input).raw)).toEqual(['blockNumber', 'spoke']);
  });

  it('produces a result that survives JSON.stringify without throwing, unlike the original bigint-bearing object', () => {
    const input = { raw: { blockNumber: 21_000_000n, oraclePriceRaw: 6_900_000_000_000n } };

    expect(() => JSON.stringify(input)).toThrow(/BigInt/);
    expect(() => JSON.stringify(toJsonSafe(input))).not.toThrow();
  });
});
