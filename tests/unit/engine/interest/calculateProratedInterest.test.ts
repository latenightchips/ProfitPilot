import { describe, expect, it } from 'vitest';

import { calculateDailyInterest } from '@/engine/interest/calculateDailyInterest';
import { calculateProratedInterest } from '@/engine/interest/calculateProratedInterest';

describe('calculateProratedInterest (F-030, generalized)', () => {
  it('matches calculateDailyInterest when days = 1', () => {
    const daily = calculateDailyInterest(50000, 0.05);
    const prorated = calculateProratedInterest(50000, 0.05, 1);
    expect(daily.ok && prorated.ok && daily.value === prorated.value).toBe(true);
  });

  it('supports a fractional period, per the M2-012 DoD', () => {
    // 50,000 * 0.05 / 365 * 15.5
    const result = calculateProratedInterest(50000, 0.05, 15.5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(106.1644, 4);
      expect(result.metadata.formulaId).toBe('F-030');
    }
  });

  it('returns 0 for a zero-length period', () => {
    const result = calculateProratedInterest(50000, 0.05, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects a negative day count', () => {
    expect(calculateProratedInterest(50000, 0.05, -1).ok).toBe(false);
  });

  it('rejects an invalid (negative) rate, per the M2-012 DoD', () => {
    expect(calculateProratedInterest(50000, -0.01, 30).ok).toBe(false);
  });

  it('rejects negative debt', () => {
    expect(calculateProratedInterest(-1, 0.05, 30).ok).toBe(false);
  });
});
