import { describe, expect, it } from 'vitest';

import { calculateBtcPurchasedPerLoop } from '@/engine/loop/calculateBtcPurchasedPerLoop';

describe('calculateBtcPurchasedPerLoop (F-015)', () => {
  it('matches the documented example: borrow $30,000, BTC price $60,000 -> 0.50 BTC', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0.5);
      expect(result.metadata.formulaId).toBe('F-015');
    }
  });

  it('matches Scenario A from the Leverage & Loop unit test examples: borrow $25,000, BTC price $50,000 -> 0.50 BTC', () => {
    const result = calculateBtcPurchasedPerLoop(25000, 50000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0.5);
  });

  it('returns 0 for a zero borrow amount', () => {
    const result = calculateBtcPurchasedPerLoop(0, 60000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects a negative borrow amount', () => {
    expect(calculateBtcPurchasedPerLoop(-1, 60000).ok).toBe(false);
  });

  it('rejects a non-positive BTC price', () => {
    expect(calculateBtcPurchasedPerLoop(30000, 0).ok).toBe(false);
  });
});
