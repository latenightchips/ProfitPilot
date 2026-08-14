import { describe, expect, it } from 'vitest';

import { mapAaveReserves } from '@/infrastructure/protocols/aave/mapAaveReserve';
import { AAVE_V3_ETHEREUM_MAINNET } from '@/infrastructure/protocols/aave/market';
import type { RawAaveReserve } from '@/infrastructure/protocols/aave/types';

/**
 * Aave reserve mapping — "API-response fixture tests." Fixture values
 * below are self-consistent, realistic RAY/basis-point-scaled figures
 * (not a captured live response — this session could not reach Aave's
 * or The Graph's API to record one; see this batch's own report), built
 * the same way the wire format documents itself (Aave's own
 * `aave/protocol-subgraphs` README).
 */
function wbtcReserve(overrides: Partial<RawAaveReserve> = {}): RawAaveReserve {
  return {
    id: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    symbol: 'WBTC',
    decimals: 8,
    baseLTVasCollateral: '7300', // 73.00%
    reserveLiquidationThreshold: '7800', // 78.00%
    variableBorrowRate: '10000000000000000000000000', // 1% APR — WBTC borrow rate, unused for this pair
    liquidityRate: '5000000000000000000000000', // 0.5% APR — WBTC supply rate
    lastUpdateTimestamp: 1_800_000_000,
    price: {
      priceInEth: '15000000000000000000', // 15 ETH
      oracle: { usdPriceEth: '200000000000' }, // $2,000/ETH -> $30,000 WBTC
    },
    ...overrides,
  };
}

function usdcReserve(overrides: Partial<RawAaveReserve> = {}): RawAaveReserve {
  return {
    id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
    baseLTVasCollateral: '0',
    reserveLiquidationThreshold: '0',
    variableBorrowRate: '50000000000000000000000000', // 5% APR — the borrow rate this pair actually uses
    liquidityRate: '30000000000000000000000000', // 3% APR — unused for this pair
    lastUpdateTimestamp: 1_800_000_000,
    price: {
      priceInEth: '500000000000000',
      oracle: { usdPriceEth: '200000000000' },
    },
    ...overrides,
  };
}

describe('mapAaveReserves', () => {
  it("maps the collateral reserve's own price/LTV/liquidation threshold and the borrow reserve's own borrow rate", () => {
    const result = mapAaveReserves([wbtcReserve(), usdcReserve()], AAVE_V3_ETHEREUM_MAINNET);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.priceCandidate).toEqual({
      origin: 'provider',
      price: 30000,
      timestamp: new Date(1_800_000_000 * 1000).toISOString(),
    });
    expect(result.data.protocolCandidate).toEqual({
      origin: 'live',
      timestamp: new Date(1_800_000_000 * 1000).toISOString(),
      parameters: {
        maxLoanToValue: 0.73,
        liquidationThreshold: 0.78,
        borrowApr: 0.05, // USDC's own variableBorrowRate, not WBTC's
        supplyApr: 0.005, // WBTC's own liquidityRate, not USDC's
      },
    });
    expect(result.data.collateralSymbol).toBe('WBTC');
    expect(result.data.borrowSymbol).toBe('USDC');
  });

  it('fails cleanly when the collateral reserve is missing from the response', () => {
    const result = mapAaveReserves([usdcReserve()], AAVE_V3_ETHEREUM_MAINNET);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_COLLATERAL_RESERVE_NOT_FOUND');
  });

  it('fails cleanly when the borrow reserve is missing from the response', () => {
    const result = mapAaveReserves([wbtcReserve()], AAVE_V3_ETHEREUM_MAINNET);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_BORROW_RESERVE_NOT_FOUND');
  });

  it('fails cleanly when the response has no reserves at all', () => {
    const result = mapAaveReserves([], AAVE_V3_ETHEREUM_MAINNET);
    expect(result.ok).toBe(false);
  });

  it('is order-independent — collateral/borrow reserves can arrive in either order', () => {
    const forward = mapAaveReserves([wbtcReserve(), usdcReserve()], AAVE_V3_ETHEREUM_MAINNET);
    const reversed = mapAaveReserves([usdcReserve(), wbtcReserve()], AAVE_V3_ETHEREUM_MAINNET);
    expect(forward).toEqual(reversed);
  });
});
