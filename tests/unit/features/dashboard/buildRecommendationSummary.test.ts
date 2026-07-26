import { beforeEach, describe, expect, it } from 'vitest';

import { buildRecommendationSummary } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Recommendation Summary builder — 06_TASKS.md M5-015. Reuses
 * `calculateTargetHealthFactorActions` (Batch 4) rather than
 * `generateRecommendationSet` — see `../types/recommendationSummary.ts`
 * for the full reasoning.
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

function createPortfolio(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  return created.data;
}

describe('buildRecommendationSummary — no target configured', () => {
  it('returns an empty list', () => {
    const portfolio = createPortfolio();
    expect(buildRecommendationSummary(portfolio).items).toEqual([]);
  });
});

describe('buildRecommendationSummary — target already met', () => {
  it('returns an empty list rather than "no action needed" entries', () => {
    // Current HF = 4; target of 1 is already exceeded.
    const portfolio = createPortfolio({ settings: { safetyTargets: { targetHealthFactor: 1 } } });
    expect(buildRecommendationSummary(portfolio).items).toEqual([]);
  });
});

describe('buildRecommendationSummary — target below current Health Factor', () => {
  it('returns both recommendations, ranked 1 and 2, with the full Display field set', () => {
    const portfolio = createPortfolio({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    const summary = buildRecommendationSummary(portfolio);

    expect(summary.items).toHaveLength(2);
    expect(summary.items[0].priority).toBe(1);
    expect(summary.items[1].priority).toBe(2);
    expect(summary.items[0].category).toBe('debtManagement');
    expect(summary.items[1].category).toBe('collateralManagement');
    for (const item of summary.items) {
      expect(item.riskLevel).toBe('Maintain Target Health Factor');
      expect(item.explanation.length).toBeGreaterThan(0);
      expect(item.suggestedAction.length).toBeGreaterThan(0);
      expect(item.expectedEffect.length).toBeGreaterThan(0);
    }
  });
});
