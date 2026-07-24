import { describe, expect, it } from 'vitest';

import { calculateLoanToValue } from '@/engine/portfolio/calculateLoanToValue';

describe('calculateLoanToValue (F-020)', () => {
  it('matches the documented example: debt $50,000 / collateral $100,000 = 50%', () => {
    const result = calculateLoanToValue(50000, 100000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0.5);
      expect(result.metadata.formulaId).toBe('F-020');
    }
  });

  it('returns 0 when there is no collateral and no debt', () => {
    const result = calculateLoanToValue(0, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0);
      expect(result.warnings).toHaveLength(1);
    }
  });

  it('fails with a structured error for debt against zero collateral', () => {
    const result = calculateLoanToValue(1000, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DIVISION_BY_ZERO');
  });

  it('rejects negative inputs', () => {
    expect(calculateLoanToValue(-1, 100).ok).toBe(false);
    expect(calculateLoanToValue(1, -100).ok).toBe(false);
  });
});
