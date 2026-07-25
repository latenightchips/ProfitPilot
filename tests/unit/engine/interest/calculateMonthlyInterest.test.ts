import { describe, expect, it } from 'vitest';

import { calculateMonthlyInterest } from '@/engine/interest/calculateMonthlyInterest';

describe('calculateMonthlyInterest (F-031)', () => {
  it('matches the documented equation (Daily Interest × 30) at full precision', () => {
    // 02_Formulas.md's own F-031 example ("Daily $6.85, Monthly $205.50")
    // multiplies the *rounded* daily figure by 30. 02_Formulas.md's own
    // "ROUNDING POLICY" ("Never round intermediate calculations") means the
    // Engine must not do that — this asserts the full-precision result
    // (debt $50,000, APR 5%: unrounded daily interest x30 = ~205.48, not
    // the doc's rounded-then-multiplied 205.50). See PROJECT_STATUS.md.
    const result = calculateMonthlyInterest(50000, 0.05);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(205.4795, 4);
      expect(result.metadata.formulaId).toBe('F-031');
    }
  });

  it('returns 0 for a zero rate', () => {
    const result = calculateMonthlyInterest(50000, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('propagates a validation failure from the underlying daily interest calculation', () => {
    const result = calculateMonthlyInterest(50000, -0.01);
    expect(result.ok).toBe(false);
  });
});
