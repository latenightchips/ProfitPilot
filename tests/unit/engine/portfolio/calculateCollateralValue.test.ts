import { describe, expect, it } from 'vitest';

import { calculateCollateralValue } from '@/engine/portfolio/calculateCollateralValue';

describe('calculateCollateralValue (F-002)', () => {
  it('matches the documented example: 1.5 BTC at $40,000 = $60,000', () => {
    const result = calculateCollateralValue(
      { asset: 'BTC', quantity: 1.5 },
      { btcPriceUsd: 40000 },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(60000);
      expect(result.metadata.formulaId).toBe('F-002');
    }
  });

  it('returns 0 for no collateral', () => {
    const result = calculateCollateralValue({ asset: 'BTC', quantity: 0 }, { btcPriceUsd: 40000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects negative collateral quantity', () => {
    const result = calculateCollateralValue({ asset: 'BTC', quantity: -1 }, { btcPriceUsd: 40000 });
    expect(result.ok).toBe(false);
  });

  it('rejects a zero or negative BTC price', () => {
    const result = calculateCollateralValue({ asset: 'BTC', quantity: 1 }, { btcPriceUsd: 0 });
    expect(result.ok).toBe(false);
  });
});
