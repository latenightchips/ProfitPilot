import { describe, expect, it } from 'vitest';

import { calculateDebtRatio } from '@/engine/portfolio/calculateDebtRatio';

describe('calculateDebtRatio (F-006)', () => {
  it('matches the documented example: debt $40,000, portfolio $100,000 -> 40%', () => {
    const result = calculateDebtRatio(40000, 100000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(0.4, 8);
      expect(result.metadata.formulaId).toBe('F-006');
    }
  });

  it('returns 0 when both debt and portfolio value are zero', () => {
    const result = calculateDebtRatio(0, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('fails when debt exists with zero portfolio value', () => {
    const result = calculateDebtRatio(1000, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DIVISION_BY_ZERO');
  });

  it('rejects negative debt', () => {
    expect(calculateDebtRatio(-1, 100000).ok).toBe(false);
  });

  it('rejects negative portfolio value', () => {
    expect(calculateDebtRatio(40000, -1).ok).toBe(false);
  });
});
