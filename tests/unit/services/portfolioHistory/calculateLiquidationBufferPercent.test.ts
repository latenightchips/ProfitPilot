import { describe, expect, it } from 'vitest';

import { calculateLiquidationBufferPercent } from '@/services/portfolioHistory/calculateLiquidationBufferPercent';

describe('calculateLiquidationBufferPercent', () => {
  it('computes a normal positive buffer as a fraction', () => {
    // (50000 - 12500) / 50000 = 0.75
    expect(calculateLiquidationBufferPercent(50000, 12500)).toBe(0.75);
  });

  it('computes a zero buffer when market price equals liquidation price', () => {
    expect(calculateLiquidationBufferPercent(50000, 50000)).toBe(0);
  });

  it('computes a negative buffer without clamping when market price is below liquidation price', () => {
    // (40000 - 50000) / 40000 = -0.25
    expect(calculateLiquidationBufferPercent(40000, 50000)).toBe(-0.25);
  });

  it('returns null (not 0) when liquidationPriceUsd is null — no liquidation risk', () => {
    expect(calculateLiquidationBufferPercent(50000, null)).toBeNull();
  });

  it('returns null, not NaN/Infinity, for a zero market-price denominator', () => {
    const result = calculateLiquidationBufferPercent(0, 12500);
    expect(result).toBeNull();
    expect(result).not.toBeNaN();
  });

  it('returns null, not NaN/Infinity, for a negative market-price denominator', () => {
    expect(calculateLiquidationBufferPercent(-1, 12500)).toBeNull();
  });

  it('returns null, not NaN/Infinity, for a non-finite market price', () => {
    expect(calculateLiquidationBufferPercent(Number.NaN, 12500)).toBeNull();
    expect(calculateLiquidationBufferPercent(Number.POSITIVE_INFINITY, 12500)).toBeNull();
  });

  it('returns null, not NaN/Infinity, for a non-finite liquidation price', () => {
    expect(calculateLiquidationBufferPercent(50000, Number.POSITIVE_INFINITY)).toBeNull();
  });
});
