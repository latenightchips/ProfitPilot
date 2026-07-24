import { describe, expect, it } from 'vitest';

import { calculateLiquidationDistance } from '@/engine/liquidation/calculateLiquidationDistance';

describe('calculateLiquidationDistance (F-023)', () => {
  it('matches the documented example: HF 1.75 gives distance 0.75', () => {
    // Collateral $175,000, threshold 100%, debt $100,000 -> HF = 1.75
    const result = calculateLiquidationDistance(175000, 1, 100000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(0.75, 10);
      expect(result.metadata.formulaId).toBe('F-023');
    }
  });

  it('matches the F-022 documented example: collateral $100,000, threshold 80%, debt $50,000 -> distance 0.60', () => {
    const result = calculateLiquidationDistance(100000, 0.8, 50000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(0.6, 10);
  });

  it('propagates infinite distance and the NO_DEBT warning when debt is zero', () => {
    const result = calculateLiquidationDistance(100000, 0.8, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(Infinity);
      expect(result.warnings.some((w) => w.code === 'NO_DEBT')).toBe(true);
    }
  });

  it('propagates a validation failure', () => {
    const result = calculateLiquidationDistance(-1, 0.8, 50000);
    expect(result.ok).toBe(false);
  });
});
