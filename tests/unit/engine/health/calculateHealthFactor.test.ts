import { describe, expect, it } from 'vitest';

import { calculateHealthFactor } from '@/engine/health/calculateHealthFactor';

describe('calculateHealthFactor (F-022)', () => {
  it('matches the documented example: collateral $100,000, threshold 80%, debt $50,000 = HF 1.60', () => {
    const result = calculateHealthFactor(100000, 0.8, 50000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(1.6);
      expect(result.metadata.formulaId).toBe('F-022');
    }
  });

  it('handles zero debt safely by returning Infinity with a warning, per the M2-009 DoD', () => {
    const result = calculateHealthFactor(100000, 0.8, 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(Infinity);
      expect(result.warnings.some((w) => w.code === 'NO_DEBT')).toBe(true);
    }
  });

  it('returns 0 for zero collateral with debt (well-defined, not an error)', () => {
    const result = calculateHealthFactor(0, 0.8, 50000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects a threshold outside [0, 1]', () => {
    expect(calculateHealthFactor(100000, 1.5, 50000).ok).toBe(false);
  });

  it('rejects negative collateral or debt', () => {
    expect(calculateHealthFactor(-1, 0.8, 50000).ok).toBe(false);
    expect(calculateHealthFactor(100000, 0.8, -1).ok).toBe(false);
  });
});
