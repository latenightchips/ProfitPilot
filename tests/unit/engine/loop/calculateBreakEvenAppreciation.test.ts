import { describe, expect, it } from 'vitest';

import { calculateBreakEvenAppreciation } from '@/engine/loop/calculateBreakEvenAppreciation';

describe('calculateBreakEvenAppreciation (F-037)', () => {
  it('matches the documented example: interest $2,500, exposure $150,000 -> 1.67% required return', () => {
    const result = calculateBreakEvenAppreciation(2500, 150000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeCloseTo(0.016667, 6);
      expect(result.metadata.formulaId).toBe('F-037');
    }
  });

  it('returns 0 when there is no interest cost', () => {
    const result = calculateBreakEvenAppreciation(0, 150000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects negative annual interest', () => {
    expect(calculateBreakEvenAppreciation(-1, 150000).ok).toBe(false);
  });

  it('rejects zero or negative exposure', () => {
    expect(calculateBreakEvenAppreciation(2500, 0).ok).toBe(false);
  });
});
