import { describe, expect, it } from 'vitest';

import { calculateDebtGrowth } from '@/engine/simulation/calculateDebtGrowth';

describe('calculateDebtGrowth (F-033)', () => {
  it('matches the documented example: debt $50,000, interest $2,500 -> future debt $52,500', () => {
    const result = calculateDebtGrowth(50000, 2500);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(52500);
      expect(result.metadata.formulaId).toBe('F-033');
    }
  });

  it('returns the unchanged debt when accrued interest is 0', () => {
    const result = calculateDebtGrowth(50000, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(50000);
  });

  it('rejects negative current debt', () => {
    expect(calculateDebtGrowth(-1, 2500).ok).toBe(false);
  });

  it('rejects negative accrued interest', () => {
    expect(calculateDebtGrowth(50000, -1).ok).toBe(false);
  });
});
