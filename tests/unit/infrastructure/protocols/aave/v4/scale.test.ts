import { describe, expect, it } from 'vitest';

import {
  assetUnitsToDecimal,
  basisPointsToDecimal,
  rayToDecimal,
} from '@/infrastructure/protocols/aave/v4/scale';

describe('rayToDecimal', () => {
  it('converts RAY (1e27) to 1.0', () => {
    expect(rayToDecimal(1_000_000_000_000_000_000_000_000_000n)).toBe(1);
  });

  it('converts 5% APR (0.05e27) to 0.05', () => {
    expect(rayToDecimal(50_000_000_000_000_000_000_000_000n)).toBeCloseTo(0.05, 10);
  });

  it('converts 0 to 0', () => {
    expect(rayToDecimal(0n)).toBe(0);
  });
});

describe('basisPointsToDecimal', () => {
  it('converts 10000 BPS to 1.0 (100%)', () => {
    expect(basisPointsToDecimal(10000n)).toBe(1);
  });

  it('converts 1000 BPS to 0.10 (10%)', () => {
    expect(basisPointsToDecimal(1000n)).toBeCloseTo(0.1, 10);
  });

  it('converts a Risk Premium above 100% (100_000 BPS = 1000%, docs/overview.md stated ceiling)', () => {
    expect(basisPointsToDecimal(100_000n)).toBeCloseTo(10.0, 10);
  });

  it('converts 0 BPS to 0', () => {
    expect(basisPointsToDecimal(0n)).toBe(0);
  });
});

describe('assetUnitsToDecimal', () => {
  it('converts a USDC-scale (6 decimals) raw amount to a dollar number', () => {
    expect(assetUnitsToDecimal(20_000_000_000n, 6)).toBe(20000);
  });

  it('converts a WBTC-scale (8 decimals) raw amount', () => {
    expect(assetUnitsToDecimal(150_000_000n, 8)).toBe(1.5);
  });

  it('converts 0 raw units to 0 regardless of decimals', () => {
    expect(assetUnitsToDecimal(0n, 6)).toBe(0);
  });
});
