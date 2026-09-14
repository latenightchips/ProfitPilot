import { describe, expect, it } from 'vitest';

import { calculateRiskCategory } from '@/engine/health/calculateRiskCategory';

/**
 * Risk Category — 02_Formulas.md F-026. Owner decision (PROJECT_STATUS.md
 * conflict #1, closed): canonical basis `01_PRD.md` REQ-005-A, mutually
 * exclusive descending-comparison bands. Boundary values below are the
 * owner's own exact required test values.
 */
describe('calculateRiskCategory (F-026, owner decision)', () => {
  it('tags F-026 at runtime', () => {
    const result = calculateRiskCategory(3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.formulaId).toBe('F-026');
  });

  it.each<[number, string]>([
    [Infinity, 'SAFE'],
    [2.500001, 'SAFE'],
    [2.5, 'MONITOR'],
    [2.000001, 'MONITOR'],
    [2.0, 'ELEVATED'],
    [1.500001, 'ELEVATED'],
    [1.5, 'HIGH RISK'],
    [1.200001, 'HIGH RISK'],
    [1.2, 'LIQUIDATION RISK'],
    [1.0, 'LIQUIDATION RISK'],
    [0.99, 'LIQUIDATION RISK'],
  ])('classifies Health Factor %s as %s', (healthFactor, expected) => {
    const result = calculateRiskCategory(healthFactor);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(expected);
  });

  it('classifies zero Health Factor as LIQUIDATION RISK', () => {
    const result = calculateRiskCategory(0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('LIQUIDATION RISK');
  });

  it('compares the real numeric value without rounding — 2.004 stays MONITOR, not rounded up to 2.00-exclusive ELEVATED', () => {
    const result = calculateRiskCategory(2.004);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('MONITOR');
  });

  it("compares the real numeric value without rounding — 1.999999 is just above the ELEVATED/MONITOR boundary's MONITOR side, so it stays ELEVATED", () => {
    // 1.999999 <= 2.00, and > 1.50, so ELEVATED per the mutually-exclusive bands.
    const result = calculateRiskCategory(1.999999);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe('ELEVATED');
  });

  it('rejects NaN, never fabricating a classification', () => {
    const result = calculateRiskCategory(Number.NaN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_HEALTH_FACTOR');
  });

  it('rejects a negative Health Factor', () => {
    const result = calculateRiskCategory(-1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects -Infinity', () => {
    const result = calculateRiskCategory(Number.NEGATIVE_INFINITY);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });
});
