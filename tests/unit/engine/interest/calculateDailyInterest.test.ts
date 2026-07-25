import { describe, expect, it } from 'vitest';

import { calculateDailyInterest } from '@/engine/interest/calculateDailyInterest';

describe('calculateDailyInterest (F-030)', () => {
  it('matches the documented example: debt $50,000, APR 5% ≈ $6.85', () => {
    const result = calculateDailyInterest(50000, 0.05);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(6.8493, 4);
      expect(result.metadata.formulaId).toBe('F-030');
    }
  });

  it('returns 0 for a zero rate, per the M2-012 DoD', () => {
    const result = calculateDailyInterest(50000, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('returns 0 for zero debt, per the M2-012 DoD', () => {
    const result = calculateDailyInterest(0, 0.05);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects an invalid (negative) rate, per the M2-012 DoD', () => {
    const result = calculateDailyInterest(50000, -0.01);
    expect(result.ok).toBe(false);
  });

  it('rejects negative debt', () => {
    expect(calculateDailyInterest(-1, 0.05).ok).toBe(false);
  });
});
