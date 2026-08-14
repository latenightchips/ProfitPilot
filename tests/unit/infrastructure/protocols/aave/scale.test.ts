import { describe, expect, it } from 'vitest';

import {
  basisPointsToDecimal,
  deriveUsdPrice,
  rayToDecimal,
} from '@/infrastructure/protocols/aave/scale';

/**
 * Wire-format scale conversions — Phase 1 Aave live-data integration.
 * Each conversion is a pure unit rescale (basis points, RAY, wei/8-decimal
 * cross price), not a financial calculation — see `scale.ts`'s own header
 * comment for the exact Aave convention each divisor implements.
 */
describe('basisPointsToDecimal', () => {
  it('converts a real Aave LTV value (8000 = 80.00%) to a plain [0,1] decimal', () => {
    expect(basisPointsToDecimal('8000')).toBe(0.8);
  });

  it('converts a real Aave liquidation threshold value (8500 = 85.00%)', () => {
    expect(basisPointsToDecimal('8500')).toBe(0.85);
  });

  it('converts zero', () => {
    expect(basisPointsToDecimal('0')).toBe(0);
  });

  it('converts the maximum possible basis-point value (10000 = 100.00%)', () => {
    expect(basisPointsToDecimal('10000')).toBe(1);
  });
});

describe('rayToDecimal', () => {
  it('converts a 5% RAY-scaled rate to a plain [0,1] decimal', () => {
    // 0.05 * 10^27
    expect(rayToDecimal('50000000000000000000000000')).toBeCloseTo(0.05, 10);
  });

  it('converts a 20% RAY-scaled rate', () => {
    expect(rayToDecimal('200000000000000000000000000')).toBeCloseTo(0.2, 10);
  });

  it('converts zero', () => {
    expect(rayToDecimal('0')).toBe(0);
  });

  it('handles a RAY-scaled rate with sub-percent precision (0.0123%)', () => {
    // 0.000123 * 10^27
    expect(rayToDecimal('123000000000000000000000')).toBeCloseTo(0.000123, 12);
  });
});

describe('deriveUsdPrice', () => {
  it('derives a plausible BTC/USD price from ETH-cross oracle fields', () => {
    // 15 ETH (priceInEth, 18-decimal wei) at $2,000/ETH (usdPriceEth, 8-decimal) -> $30,000.
    const priceInEth = '15000000000000000000';
    const usdPriceEth = '200000000000';
    expect(deriveUsdPrice(priceInEth, usdPriceEth)).toBeCloseTo(30000, 6);
  });

  it('returns zero when priceInEth is zero', () => {
    expect(deriveUsdPrice('0', '200000000000')).toBe(0);
  });

  it('returns zero when usdPriceEth is zero', () => {
    expect(deriveUsdPrice('15000000000000000000', '0')).toBe(0);
  });
});
