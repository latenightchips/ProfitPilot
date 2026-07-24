import { describe, expect, it } from 'vitest';

import { calculatePortfolioValue } from '@/engine/portfolio/calculatePortfolioValue';

describe('calculatePortfolioValue (F-001)', () => {
  it('matches the documented example: 2 BTC at $50,000 = $100,000', () => {
    const result = calculatePortfolioValue({ asset: 'BTC', quantity: 2 }, { btcPriceUsd: 50000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(100000);
      expect(result.metadata.formulaId).toBe('F-001');
    }
  });

  it('matches the documented edge case: 0 BTC = $0', () => {
    const result = calculatePortfolioValue({ asset: 'BTC', quantity: 0 }, { btcPriceUsd: 50000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('propagates a validation failure from Collateral Value', () => {
    const result = calculatePortfolioValue({ asset: 'BTC', quantity: -1 }, { btcPriceUsd: 50000 });
    expect(result.ok).toBe(false);
  });
});
