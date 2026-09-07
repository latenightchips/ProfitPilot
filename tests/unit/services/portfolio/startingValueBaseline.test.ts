import { describe, expect, it } from 'vitest';

import { calculateStartingValueBaselineComparison } from '@/services/portfolio/startingValueBaseline';
import type { Portfolio } from '@/types/portfolio';

/**
 * Starting-Value Baseline comparison — v1.17.0 Batch 1. Canonical
 * specification: `docs/STARTING_VALUE_BASELINE_SPEC.md` §4, §5, §6.
 * `stores/portfolioStore.test.ts` also exercises this function through
 * `setBaseline`/other Store actions (the integration path); this file
 * tests the pure function in isolation, matching this directory's own
 * one-file-per-Service convention (`exposure.test.ts`, `mapping.test.ts`).
 */
function basePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('calculateStartingValueBaselineComparison — no baseline (v1.17.0 Batch 1)', () => {
  it('returns null when none of the three baseline fields are set', () => {
    expect(calculateStartingValueBaselineComparison(basePortfolio())).toBeNull();
  });

  it('returns null when only some baseline fields are set (should never happen via setBaseline, but defensively checked)', () => {
    expect(
      calculateStartingValueBaselineComparison(
        basePortfolio({ establishedAt: '2026-01-01T00:00:00.000Z' }),
      ),
    ).toBeNull();
  });
});

describe('calculateStartingValueBaselineComparison — §4 current comparison (v1.17.0 Batch 1)', () => {
  it('computes baseline/current value, absolute and percentage change for an unchanged quantity', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 60000 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison).not.toBeNull();
    if (comparison === null) return;
    expect(comparison.establishedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(comparison.baselineCollateralQuantity).toBe(2);
    expect(comparison.baselineValueUsd).toBe(100000);
    expect(comparison.currentCollateralQuantity).toBe(2);
    expect(comparison.currentValueUsd).toBe(120000);
    expect(comparison.absoluteChangeUsd).toBe(20000);
    expect(comparison.percentageChange).toBe(0.2);
    expect(comparison.status).toBe('current');
  });

  it('percentage change denominator is baselineValue, never currentValue', () => {
    // Baseline value 100,000; current value 50,000 -> -50%. If the
    // denominator were currentValue, this would (wrongly) read -100%.
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 25000 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison).not.toBeNull();
    if (comparison === null) return;
    expect(comparison.percentageChange).toBe(-0.5);
  });

  it('a negative change is represented as a negative absolute/percentage change, not clamped', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 40000 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison).not.toBeNull();
    if (comparison === null) return;
    expect(comparison.absoluteChangeUsd).toBe(-20000);
    expect(comparison.percentageChange).toBe(-0.2);
  });
});

describe('calculateStartingValueBaselineComparison — §5/§6 quantity-change detection (v1.17.0 Batch 1)', () => {
  it('status is "current" when live quantity exactly equals the recorded baseline quantity', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison?.status).toBe('current');
  });

  it('status is "compositionChanged" for any quantity increase, regardless of cause', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2.5 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison?.status).toBe('compositionChanged');
  });

  it('status is "compositionChanged" for any quantity decrease, regardless of cause', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 1.5 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison?.status).toBe('compositionChanged');
  });

  it("the baseline's own recorded facts (establishedAt/baselineCollateralQuantity/baselineValueUsd) are unaffected by a composition change", () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 5 },
      market: { btcPriceUsd: 50000 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison).not.toBeNull();
    if (comparison === null) return;
    expect(comparison.status).toBe('compositionChanged');
    expect(comparison.establishedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(comparison.baselineCollateralQuantity).toBe(2);
    expect(comparison.baselineValueUsd).toBe(100000);
    // Current figures are still computed, per Decision 3 ("mark as
    // partial/stale," not "suppress the comparison").
    expect(comparison.currentCollateralQuantity).toBe(5);
    expect(comparison.currentValueUsd).toBe(250000);
  });

  it('a price-only change never flips status away from "current"', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 999999 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison?.status).toBe('current');
  });
});

describe('calculateStartingValueBaselineComparison — §4 zero-baseline-value edge case (v1.17.0 Batch 1)', () => {
  it('percentageChange is null (never NaN/Infinity) when baseline collateral quantity was 0', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 0,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 1 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison).not.toBeNull();
    if (comparison === null) return;
    expect(comparison.baselineValueUsd).toBe(0);
    expect(comparison.percentageChange).toBeNull();
    expect(Number.isNaN(comparison.percentageChange as unknown as number)).toBe(false);
  });

  it('absoluteChangeUsd remains well-defined even when percentageChange is unavailable', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 0,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 60000 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison).not.toBeNull();
    if (comparison === null) return;
    expect(comparison.absoluteChangeUsd).toBe(120000);
    expect(Number.isFinite(comparison.absoluteChangeUsd)).toBe(true);
  });

  it('a zero baseline that is still zero (quantity unchanged at 0) reports "current" with a zero absolute change', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 0,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 0 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison).not.toBeNull();
    if (comparison === null) return;
    expect(comparison.status).toBe('current');
    expect(comparison.absoluteChangeUsd).toBe(0);
    expect(comparison.percentageChange).toBeNull();
  });
});

describe('calculateStartingValueBaselineComparison — provenance/protocol independence (v1.17.0 Batch 1)', () => {
  it('produces identical figures for a V3 and a V4-flagged portfolio holding the same collateral/market values (only collateral/market are read)', () => {
    const v3 = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2.5 },
      market: { btcPriceUsd: 55000 },
    });
    const v4 = basePortfolio({
      ...v3,
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 1000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const v3Comparison = calculateStartingValueBaselineComparison(v3);
    const v4Comparison = calculateStartingValueBaselineComparison(v4);
    expect(v3Comparison).toEqual(v4Comparison);
  });

  it('is unaffected by marketSource/protocolSource (manual vs live provenance)', () => {
    const manual = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      marketSource: 'manual',
    });
    const live = basePortfolio({ ...manual, marketSource: 'live' });
    expect(calculateStartingValueBaselineComparison(manual)).toEqual(
      calculateStartingValueBaselineComparison(live),
    );
  });
});
