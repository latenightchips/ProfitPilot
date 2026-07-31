import { describe, expect, it } from 'vitest';

import { calculatePortfolioExposure } from '@/services/portfolio/exposure';
import type { ApplicationPortfolio } from '@/services/portfolio/models';

/**
 * Portfolio BTC Exposure — added Milestone 7 Batch 2 to support
 * M7-011's own "BTC exposure" Display item. A thin wrapper around
 * `calculateExposure` (F-010) — see this Service's own header comment.
 */
function basePortfolio(): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  };
}

describe('calculatePortfolioExposure (Milestone 7 Batch 2)', () => {
  it('returns Exposure as collateral quantity × BTC price (F-010, a USD value)', () => {
    const result = calculatePortfolioExposure(basePortfolio(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(100000);
  });

  it('threads sourceStatus through to metadata', () => {
    const result = calculatePortfolioExposure(basePortfolio(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sourceStatus).toBe('manual');
  });

  it('propagates a genuine Engine failure for malformed input (negative collateral quantity)', () => {
    const invalid: ApplicationPortfolio = {
      ...basePortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    const result = calculatePortfolioExposure(invalid, 'manual');
    expect(result.ok).toBe(false);
  });
});
