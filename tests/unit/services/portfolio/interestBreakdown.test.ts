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

/**
 * V4 fail-closed guard — V4 Readiness Audit §12 Stage 10. This Service
 * reads debt/`protocol.borrowApr` directly, so a V4 portfolio with no
 * synced `v4DebtState` must fail closed rather than silently computing a
 * daily/monthly breakdown from stale legacy `debt.balance`.
 */
describe('calculateDebtInterestBreakdown — V4 fail-closed guard (Stage 10)', () => {
  it('fails with AAVE_V4_DEBT_STATE_MISSING for a "v4" portfolio with no synced v4DebtState', () => {
    const result = calculateDebtInterestBreakdown(
      { ...basePortfolio(), protocolVersion: 'v4' },
      'manual',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('succeeds once v4DebtState is synced, using the canonical drawnDebt + premiumDebt total', () => {
    const result = calculateDebtInterestBreakdown(
      {
        ...basePortfolio(),
        protocolVersion: 'v4',
        v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      },
      'manual',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Daily = 15500 * 0.05 / 365 (still the legacy protocol.borrowApr rate
    // for this Service — Stage 10 only named interestCost/debtCost for the
    // rate fix; this Service's own rate remains open, same as before).
    expect(result.data.daily).toBeCloseTo((15500 * 0.05) / 365, 5);
  });

  it('never fails or substitutes for a "v3" (or unset) portfolio, even when v4DebtState happens to be present (no cross-inference)', () => {
    const result = calculateDebtInterestBreakdown(
      {
        ...basePortfolio(),
        v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      },
      'manual',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.daily).toBeCloseTo(2.739726, 5);
  });
});
