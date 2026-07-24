import { describe, expect, it } from 'vitest';

import { calculateLiquidationBuffer } from '@/engine/liquidation/calculateLiquidationBuffer';

describe('calculateLiquidationBuffer (F-025)', () => {
  it('matches the documented example: BTC $60,000, liquidation $45,000 = 25% buffer', () => {
    // Solve for inputs that produce liquidation price $45,000 at BTC $60,000:
    // liquidationPrice = btcPrice * debt / (collateral * threshold)
    // debt $90,000, collateral $120,000, threshold 100% -> 60000 * 90000 / 120000 = 45000
    const result = calculateLiquidationBuffer(60000, 90000, 120000, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(25, 10);
      expect(result.metadata.formulaId).toBe('F-025');
    }
  });

  it('returns the same value as the documented "price decline to liquidation" concept (M2-010)', () => {
    const result = calculateLiquidationBuffer(60000, 70000, 120000, 0.8);
    expect(result.ok).toBe(true);
    // Liquidation price for these inputs is ~$43,750 (F-024 example); buffer = (60000-43750)/60000*100
    if (result.ok) expect(result.value).toBeCloseTo(27.083333, 5);
  });

  it('propagates a failure from the underlying liquidation price calculation', () => {
    const result = calculateLiquidationBuffer(60000, 0, 120000, 0.8);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_APPLICABLE_NO_DEBT');
  });
});
