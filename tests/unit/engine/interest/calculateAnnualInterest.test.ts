import { describe, expect, it } from 'vitest';

import { calculateAnnualInterest } from '@/engine/interest/calculateAnnualInterest';

describe('calculateAnnualInterest (F-032)', () => {
  it('matches the documented example: debt $50,000, APR 5% = $2,500', () => {
    const result = calculateAnnualInterest(50000, 0.05);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(2500);
      expect(result.metadata.formulaId).toBe('F-032');
    }
  });

  it('returns 0 for zero debt, per the M2-012 DoD', () => {
    const result = calculateAnnualInterest(0, 0.05);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('returns 0 for a zero rate, per the M2-012 DoD', () => {
    const result = calculateAnnualInterest(50000, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects an invalid (negative) rate, per the M2-012 DoD', () => {
    expect(calculateAnnualInterest(50000, -0.01).ok).toBe(false);
  });

  it('rejects negative debt', () => {
    expect(calculateAnnualInterest(-1, 0.05).ok).toBe(false);
  });
});
