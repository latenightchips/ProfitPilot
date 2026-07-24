import { describe, expect, it } from 'vitest';

import { calculateAdditionalBorrow } from '@/engine/health/calculateAdditionalBorrow';

describe('calculateAdditionalBorrow (F-027)', () => {
  it('matches the documented example: collateral $120,000, LT 80%, target HF 1.80, debt $40,000', () => {
    // TargetDebt = 120000 * 0.8 / 1.8 = 53,333.33...; result = TargetDebt - 40,000
    const result = calculateAdditionalBorrow(120000, 0.8, 40000, 1.8);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(13333.3333, 3);
      expect(result.metadata.formulaId).toBe('F-027');
      expect(result.warnings).toEqual([]);
    }
  });

  it('returns a negative value when current debt exceeds the target, representing required repayment (M2-011)', () => {
    // TargetDebt = 100000 * 0.8 / 2.0 = 40,000; current debt 60,000 -> repay 20,000
    const result = calculateAdditionalBorrow(100000, 0.8, 60000, 2.0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(-20000, 5);
  });

  it('matches "debt increase to liquidation" (M2-010) when evaluated at target HF 1.0', () => {
    // Target debt at HF 1.0 = 100000 * 0.8 / 1.0 = 80,000; current debt 50,000 -> +30,000 to liquidation
    const result = calculateAdditionalBorrow(100000, 0.8, 50000, 1.0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(30000, 5);
  });

  it('rejects a non-positive target Health Factor', () => {
    expect(calculateAdditionalBorrow(100000, 0.8, 50000, 0).ok).toBe(false);
    expect(calculateAdditionalBorrow(100000, 0.8, 50000, -1).ok).toBe(false);
  });

  it('rejects an invalid liquidation threshold', () => {
    expect(calculateAdditionalBorrow(100000, 1.5, 50000, 1.8).ok).toBe(false);
  });

  it('rejects negative collateral or debt', () => {
    expect(calculateAdditionalBorrow(-1, 0.8, 50000, 1.8).ok).toBe(false);
    expect(calculateAdditionalBorrow(100000, 0.8, -1, 1.8).ok).toBe(false);
  });
});
