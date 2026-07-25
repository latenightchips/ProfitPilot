import { describe, expect, it } from 'vitest';

import { calculateBtcSaleRequired } from '@/engine/exit/calculateBtcSaleRequired';

describe('calculateBtcSaleRequired (F-042)', () => {
  it('matches the documented example: repayment $12,000, BTC price $60,000 -> 0.20 BTC', () => {
    const result = calculateBtcSaleRequired(12000, 60000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0.2);
      expect(result.metadata.formulaId).toBe('F-042');
    }
  });

  it('returns 0 for zero repayment', () => {
    const result = calculateBtcSaleRequired(0, 60000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects negative repayment', () => {
    expect(calculateBtcSaleRequired(-1, 60000).ok).toBe(false);
  });

  it('rejects a non-positive BTC price', () => {
    expect(calculateBtcSaleRequired(12000, 0).ok).toBe(false);
  });
});
