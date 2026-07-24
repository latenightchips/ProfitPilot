import { describe, expect, it } from 'vitest';

import { calculateExposure } from '@/engine/portfolio/calculateExposure';

describe('calculateExposure (F-010)', () => {
  it('matches the documented example: 3 BTC at $60,000 = $180,000', () => {
    const result = calculateExposure({ asset: 'BTC', quantity: 3 }, { btcPriceUsd: 60000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(180000);
      expect(result.metadata.formulaId).toBe('F-010');
    }
  });

  it('returns 0 exposure for no BTC', () => {
    const result = calculateExposure({ asset: 'BTC', quantity: 0 }, { btcPriceUsd: 60000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('propagates a validation failure', () => {
    const result = calculateExposure({ asset: 'BTC', quantity: -1 }, { btcPriceUsd: 60000 });
    expect(result.ok).toBe(false);
  });
});
