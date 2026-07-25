import { describe, expect, it } from 'vitest';

import { calculateLoopCapital } from '@/engine/loop/calculateLoopCapital';

describe('calculateLoopCapital (F-014)', () => {
  it('matches the documented example: borrow $30,000 -> loop capital $30,000', () => {
    const result = calculateLoopCapital(30000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(30000);
      expect(result.metadata.formulaId).toBe('F-014');
    }
  });

  it('returns 0 for a zero borrow amount', () => {
    const result = calculateLoopCapital(0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects a negative borrow amount', () => {
    expect(calculateLoopCapital(-1).ok).toBe(false);
  });
});
