import { beforeEach, describe, expect, it } from 'vitest';

import { buildLeverageSummary } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Leverage Summary builder — 06_TASKS.md M5-014. "Debt-to-equity ratio"
 * is intentionally not covered — see `../types/leverageSummary.ts` for
 * why (carries forward M2-008's own already-approved decision to skip
 * it, not a new gap).
 */
beforeEach(() => {
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function buildSummary(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  if (!record.summary.ok) throw new Error('expected a successful summary');
  return record.summary.data;
}

describe('buildLeverageSummary — leveraged portfolio', () => {
  it('reports gross exposure, net equity, leverage ratio, and effective BTC exposure', () => {
    const summary = buildSummary();
    const leverageSummary = buildLeverageSummary(summary);

    expect(leverageSummary.formattedGrossExposure).toBe('$100,000.00');
    expect(leverageSummary.formattedNetEquity).toBe('$80,000.00');
    expect(leverageSummary.formattedLeverageRatio).toBe('1.25x');
    expect(leverageSummary.formattedEffectiveBtcExposure).toBe('$100,000.00');
  });

  it('gross exposure and effective BTC exposure are identical (F-010, single-asset scope)', () => {
    const summary = buildSummary();
    const leverageSummary = buildLeverageSummary(summary);
    expect(leverageSummary.formattedEffectiveBtcExposure).toBe(
      leverageSummary.formattedGrossExposure,
    );
  });

  it('explains leverage in plain language, mentioning the ratio', () => {
    const summary = buildSummary();
    const leverageSummary = buildLeverageSummary(summary);
    expect(leverageSummary.explanation).toContain('1.25x');
  });
});

describe('buildLeverageSummary — zero-debt (unleveraged) portfolio', () => {
  it('reports leverage exactly 1x, not Infinity', () => {
    const summary = buildSummary({ debt: { asset: 'USDC', balance: 0 } });
    const leverageSummary = buildLeverageSummary(summary);
    expect(leverageSummary.formattedLeverageRatio).toBe('1x');
    expect(leverageSummary.explanation).toBe(
      'This portfolio is not leveraged — your net equity equals your total Bitcoin exposure.',
    );
  });
});
