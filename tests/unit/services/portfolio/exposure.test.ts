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

/**
 * V4 fail-closed guard — deliberately NOT applied here (V4 Readiness
 * Audit §12 Stage 10 audit finding). `calculateExposure` only reads
 * `collateral`/`market`, never `debt` — this Service has no stale-debt
 * risk to guard against, unlike Loop Strategy/Interest Breakdown/
 * Recommendations. Pinning this as a passing test, not just a doc
 * comment, so a future change that accidentally makes this Service
 * debt-sensitive gets caught by a real assertion.
 */
describe('calculatePortfolioExposure — no V4 guard needed (Stage 10 audit)', () => {
  it('succeeds for a "v4" portfolio even with no synced v4DebtState (Exposure never reads debt)', () => {
    const result = calculatePortfolioExposure(
      { ...basePortfolio(), protocolVersion: 'v4' },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(100000);
  });
});
