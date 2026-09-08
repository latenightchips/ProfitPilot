import { describe, expect, it } from 'vitest';

import { buildStartingValueBaselineSummary } from '@/features/dashboard';
import { calculateStartingValueBaselineComparison } from '@/services';
import type { Portfolio } from '@/types/portfolio';

/**
 * Starting-Value Baseline Summary builder — v1.20.0 Batch 1 (Dashboard
 * Starting-Value Baseline Visibility). Canonical specification:
 * `docs/STARTING_VALUE_BASELINE_SPEC.md`.
 *
 * Reuses the exact same fixture shape and accept/reject math already
 * verified by `tests/unit/services/portfolio/startingValueBaseline.test.ts`'s
 * own suite — this file proves the Dashboard builder formats that
 * already-correct output faithfully, not that the underlying comparison
 * itself is correct (already proven there).
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

describe('buildStartingValueBaselineSummary — no baseline', () => {
  it('returns hasBaseline: false with every other field null', () => {
    const summary = buildStartingValueBaselineSummary(basePortfolio());
    expect(summary).toEqual({
      hasBaseline: false,
      establishedAtFormatted: null,
      baselineValueFormatted: null,
      currentValueFormatted: null,
      changeFormatted: null,
      compositionChanged: false,
    });
  });
});

describe('buildStartingValueBaselineSummary — established baseline, unchanged composition', () => {
  it('formats baseline/current/change values exactly as the authoritative comparison computes them', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 60000 },
    });
    const summary = buildStartingValueBaselineSummary(portfolio);

    expect(summary.hasBaseline).toBe(true);
    expect(summary.baselineValueFormatted).toBe('$100,000.00');
    expect(summary.currentValueFormatted).toBe('$120,000.00');
    expect(summary.changeFormatted).toBe('+$20,000.00 (+20%)');
    expect(summary.compositionChanged).toBe(false);
  });

  it('renders a negative change without clamping', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 40000 },
    });
    const summary = buildStartingValueBaselineSummary(portfolio);
    expect(summary.changeFormatted).toBe('-$20,000.00 (-20%)');
  });
});

describe('buildStartingValueBaselineSummary — composition changed', () => {
  it('sets compositionChanged: true and still formats current figures, per §5/§6', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 3 },
      market: { btcPriceUsd: 50000 },
    });
    const summary = buildStartingValueBaselineSummary(portfolio);

    expect(summary.compositionChanged).toBe(true);
    expect(summary.baselineValueFormatted).toBe('$100,000.00');
    expect(summary.currentValueFormatted).toBe('$150,000.00');
  });

  it('a price-only change never sets compositionChanged', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 2,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 999999 },
    });
    const summary = buildStartingValueBaselineSummary(portfolio);
    expect(summary.compositionChanged).toBe(false);
  });
});

describe('buildStartingValueBaselineSummary — zero-baseline-value edge case', () => {
  it('formats the unavailable percentage change as "—", never NaN/Infinity, with absolute change still shown', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-01T00:00:00.000Z',
      collateralQuantity: 0,
      marketPriceUsd: 50000,
      collateral: { asset: 'BTC', quantity: 1 },
      market: { btcPriceUsd: 50000 },
    });
    const summary = buildStartingValueBaselineSummary(portfolio);

    expect(summary.baselineValueFormatted).toBe('$0.00');
    expect(summary.changeFormatted).toBe('+$50,000.00 (—)');
    expect(summary.changeFormatted).not.toMatch(/NaN/);
    expect(summary.changeFormatted).not.toMatch(/Infinity/);
  });
});

describe('buildStartingValueBaselineSummary — delegates to the authoritative comparison, no independent arithmetic', () => {
  it('every numeric figure traces back to a direct calculateStartingValueBaselineComparison call', () => {
    const portfolio = basePortfolio({
      establishedAt: '2026-01-15T09:30:00.000Z',
      collateralQuantity: 1.5,
      marketPriceUsd: 45000,
      collateral: { asset: 'BTC', quantity: 1.5 },
      market: { btcPriceUsd: 52000 },
    });
    const comparison = calculateStartingValueBaselineComparison(portfolio);
    expect(comparison).not.toBeNull();
    if (comparison === null) return;

    const summary = buildStartingValueBaselineSummary(portfolio);

    expect(summary.baselineValueFormatted).toBe(
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
        comparison.baselineValueUsd,
      ),
    );
    expect(summary.currentValueFormatted).toBe(
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
        comparison.currentValueUsd,
      ),
    );
    expect(summary.compositionChanged).toBe(comparison.status === 'compositionChanged');
  });

  it('produces identical figures for a V3 and a V4-flagged portfolio holding the same collateral/market values', () => {
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
    expect(buildStartingValueBaselineSummary(v3)).toEqual(buildStartingValueBaselineSummary(v4));
  });
});
