import { describe, expect, it } from 'vitest';

import { calculateDebtInterestBreakdown } from '@/services/portfolio/interestBreakdown';
import type { ApplicationPortfolio } from '@/services/portfolio/models';

/**
 * Debt Interest Breakdown — added Milestone 5 Batch 6 to support M5-013.
 * See this Service's own header comment for why Monthly/Daily are
 * computed via the real Engine formulas (F-030/F-031) rather than
 * dividing the already-known annual figure.
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

describe('calculateDebtInterestBreakdown (Batch 6)', () => {
  it('computes daily and monthly interest matching F-030/F-031 exactly', () => {
    const result = calculateDebtInterestBreakdown(basePortfolio(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Daily = 20000 * 0.05 / 365
    expect(result.data.daily).toBeCloseTo(2.739726, 5);
    // Monthly = Daily * 30
    expect(result.data.monthly).toBeCloseTo(result.data.daily * 30, 5);
  });

  it('monthly is not annual/12 — confirms the real formula chain is used, not an approximation', () => {
    const result = calculateDebtInterestBreakdown(basePortfolio(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const annual = 20000 * 0.05;
    expect(result.data.monthly).not.toBeCloseTo(annual / 12, 5);
  });

  it('handles a zero-debt portfolio without failing', () => {
    const result = calculateDebtInterestBreakdown(
      { ...basePortfolio(), debt: { asset: 'USDC', balance: 0 } },
      'manual',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.daily).toBe(0);
    expect(result.data.monthly).toBe(0);
  });
});
