import { describe, expect, it } from 'vitest';

import { aaveReservesResponseSchema } from '@/infrastructure/protocols/aave/schemas';

/**
 * Runtime validation of the Aave V3 subgraph's wire shape —
 * `04_BUILD_GUIDE.md` "TESTING REQUIREMENTS": "Invalid response,
 * Malformed data" are explicit provider-adapter test categories.
 */
function validReserve() {
  return {
    id: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    symbol: 'WBTC',
    decimals: 8,
    baseLTVasCollateral: '7300',
    reserveLiquidationThreshold: '7800',
    variableBorrowRate: '10000000000000000000000000',
    liquidityRate: '5000000000000000000000000',
    lastUpdateTimestamp: 1_800_000_000,
    price: { priceInEth: '15000000000000000000', oracle: { usdPriceEth: '200000000000' } },
  };
}

describe('aaveReservesResponseSchema — well-formed response', () => {
  it('accepts a well-formed response with one reserve', () => {
    const result = aaveReservesResponseSchema.safeParse({ data: { reserves: [validReserve()] } });
    expect(result.success).toBe(true);
  });

  it('accepts a well-formed response with zero reserves (an empty market query result)', () => {
    const result = aaveReservesResponseSchema.safeParse({ data: { reserves: [] } });
    expect(result.success).toBe(true);
  });
});

describe('aaveReservesResponseSchema — malformed response', () => {
  it('rejects a completely different shape', () => {
    expect(aaveReservesResponseSchema.safeParse({ errors: [{ message: 'boom' }] }).success).toBe(
      false,
    );
  });

  it('rejects null', () => {
    expect(aaveReservesResponseSchema.safeParse(null).success).toBe(false);
  });

  it('rejects a reserve missing a required field', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructuring-omit idiom
    const { symbol: _symbol, ...withoutSymbol } = validReserve();
    const result = aaveReservesResponseSchema.safeParse({
      data: { reserves: [withoutSymbol] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric-string rate field (a malformed/partial provider response)', () => {
    const result = aaveReservesResponseSchema.safeParse({
      data: { reserves: [{ ...validReserve(), variableBorrowRate: 'not-a-number' }] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a negative-looking basis-point string', () => {
    const result = aaveReservesResponseSchema.safeParse({
      data: { reserves: [{ ...validReserve(), baseLTVasCollateral: '-100' }] },
    });
    expect(result.success).toBe(false);
  });

  it('rejects a reserve missing the nested price.oracle field', () => {
    const withoutOracle = { ...validReserve(), price: { priceInEth: '15000000000000000000' } };
    const result = aaveReservesResponseSchema.safeParse({
      data: { reserves: [withoutOracle] },
    });
    expect(result.success).toBe(false);
  });
});
