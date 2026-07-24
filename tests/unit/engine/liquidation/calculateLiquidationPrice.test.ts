import { describe, expect, it } from 'vitest';

import { calculateLiquidationPrice } from '@/engine/liquidation/calculateLiquidationPrice';

describe('calculateLiquidationPrice (F-024)', () => {
  it('matches the documented example: BTC $60,000, collateral $120,000, debt $70,000, threshold 80% ≈ $43,750', () => {
    const result = calculateLiquidationPrice(60000, 70000, 120000, 0.8);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(43750, 5);
      expect(result.metadata.formulaId).toBe('F-024');
    }
  });

  it('fails with a structured error when there is no debt', () => {
    const result = calculateLiquidationPrice(60000, 0, 120000, 0.8);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_APPLICABLE_NO_DEBT');
  });

  it('fails with a structured error for debt against zero collateral', () => {
    const result = calculateLiquidationPrice(60000, 1000, 0, 0.8);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DIVISION_BY_ZERO');
  });

  it('rejects an invalid threshold', () => {
    expect(calculateLiquidationPrice(60000, 1000, 120000, 1.5).ok).toBe(false);
  });

  it('rejects a zero or negative BTC price', () => {
    expect(calculateLiquidationPrice(0, 1000, 120000, 0.8).ok).toBe(false);
  });

  it('rejects negative debt', () => {
    const result = calculateLiquidationPrice(60000, -1, 120000, 0.8);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects negative collateral', () => {
    const result = calculateLiquidationPrice(60000, 1000, -1, 0.8);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });
});
