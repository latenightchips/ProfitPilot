import { describe, expect, it } from 'vitest';

import {
  basisPointsToDecimal,
  oraclePriceToUsd,
  rayToDecimal,
} from '@/infrastructure/protocols/aave/v3/scale';

describe('Aave V3 raw-value scaling (unit conversion only, no calculation)', () => {
  it('converts basis points to a decimal', () => {
    expect(basisPointsToDecimal(7500n)).toBe(0.75);
    expect(basisPointsToDecimal(8000n)).toBe(0.8);
  });

  it('converts a ray-scaled value to a decimal', () => {
    expect(rayToDecimal(50_000_000_000_000_000_000_000_000n)).toBe(0.05);
  });

  it('converts an oracle price to USD using the base currency unit', () => {
    // 1e8 base currency unit (USD, per IPriceOracleGetter.sol), price = $65,000.
    expect(oraclePriceToUsd(6_500_000_000_000n, 100_000_000n)).toBe(65000);
  });
});
