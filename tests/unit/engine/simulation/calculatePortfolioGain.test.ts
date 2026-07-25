import { describe, expect, it } from 'vitest';

import { calculatePortfolioGain } from '@/engine/simulation/calculatePortfolioGain';

describe('calculatePortfolioGain (F-007)', () => {
  it('matches the documented example: started $50,000, current $82,000 -> gain $32,000', () => {
    const result = calculatePortfolioGain(82000, 50000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(32000);
      expect(result.metadata.formulaId).toBe('F-007');
    }
  });

  it('returns a negative value for a loss', () => {
    const result = calculatePortfolioGain(40000, 50000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(-10000);
  });

  it('returns 0 when current value equals initial investment', () => {
    const result = calculatePortfolioGain(50000, 50000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects negative current value', () => {
    expect(calculatePortfolioGain(-1, 50000).ok).toBe(false);
  });

  it('rejects negative initial investment', () => {
    expect(calculatePortfolioGain(50000, -1).ok).toBe(false);
  });
});
