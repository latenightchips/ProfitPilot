import { describe, expect, it } from 'vitest';

import { projectVariableDebt } from '@/engine/protocols/aaveV3/projectVariableDebt';

describe('projectVariableDebt — Aave V3 compounded variable-debt projection', () => {
  it('projects $20,000 debt at 5% APR over 365 days to the independently-derived compounded value', () => {
    const result = projectVariableDebt(20000, 0.05, 365);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(21025.41666667, 5);
    expect(result.metadata.formulaId).toBe('AAVE-V3-COMPOUND');
  });

  it.each([
    [30, 20082.360899],
    [90, 20248.101574],
    [180, 20499.280597],
    [800, 22316.265527],
  ])('projects %i days to the independently-derived value', (days, expected) => {
    const result = projectVariableDebt(20000, 0.05, days);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(expected, 3);
  });

  it('returns the unchanged debt at elapsedDays=0 (no accrual)', () => {
    const result = projectVariableDebt(20000, 0.05, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(20000);
  });

  it('returns the unchanged debt at borrowApr=0 (no rate, no accrual)', () => {
    const result = projectVariableDebt(20000, 0, 365);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(20000);
  });

  it('returns 0 for 0 debt', () => {
    const result = projectVariableDebt(0, 0.05, 365);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(0);
  });

  it('produces a strictly larger projected debt than simple interest for the same inputs (compounding > linear)', () => {
    const result = projectVariableDebt(20000, 0.05, 365);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const simpleInterestProjection = 20000 + (20000 * 0.05 * 365) / 365;
    expect(result.value).toBeGreaterThan(simpleInterestProjection);
  });

  it('rejects a negative debt balance', () => {
    const result = projectVariableDebt(-1, 0.05, 365);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects a negative APR', () => {
    const result = projectVariableDebt(20000, -0.01, 365);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects a negative elapsed-day count', () => {
    const result = projectVariableDebt(20000, 0.05, -1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('supports fractional day counts', () => {
    const result = projectVariableDebt(20000, 0.05, 15.5);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeGreaterThan(20000);
    expect(result.value).toBeLessThan(20082.360899); // less than the 30-day value
  });
});
