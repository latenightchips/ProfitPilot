import { beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardViewModel, buildPortfolioComposition } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio Composition builder — 06_TASKS.md M5-011.
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

function buildOk(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  if (!record.summary.ok) throw new Error('expected a successful summary');
  const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
  if (!viewModel.ok) throw new Error('expected a successful view model');
  return {
    portfolio: record.portfolio,
    summary: record.summary.data,
    marketFreshness: viewModel.freshness.market,
  };
}

describe('buildPortfolioComposition — collateral and debt rows', () => {
  it('reports each asset, quantity, price, value, and always-100% portfolio percentage (Conflict A)', () => {
    const { portfolio, summary, marketFreshness } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness);

    expect(composition.collateral.assetLabel).toBe('BTC');
    expect(composition.collateral.formattedQuantity).toBe('2');
    expect(composition.collateral.formattedPositionValue).toBe('$100,000.00');
    expect(composition.collateral.formattedPortfolioPercentage).toBe('100%');

    expect(composition.debt.assetLabel).toBe('USDC');
    expect(composition.debt.formattedQuantity).toBe('20,000');
    expect(composition.debt.formattedPositionValue).toBe('$20,000.00');
    expect(composition.debt.formattedPortfolioPercentage).toBe('100%');
  });

  it('reports the debt row price as not applicable (no stablecoin price lookup exists, F-003)', () => {
    const { portfolio, summary, marketFreshness } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness);
    expect(composition.debt.formattedCurrentPrice).toBe('N/A (stablecoin, 1:1 — F-003)');
  });
});

describe('buildPortfolioComposition — protocol parameters', () => {
  it('formats every protocol parameter as a percentage', () => {
    const { portfolio, summary, marketFreshness } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness);
    expect(composition.protocolParameters.formattedMaxLoanToValue).toBe('75%');
    expect(composition.protocolParameters.formattedLiquidationThreshold).toBe('80%');
    expect(composition.protocolParameters.formattedBorrowApr).toBe('5%');
    expect(composition.protocolParameters.formattedSupplyApr).toBe('2%');
  });
});

describe('buildPortfolioComposition — M5-012 allocation chart', () => {
  it('always reports showAllocationChart as false under Conflict A', () => {
    const { portfolio, summary, marketFreshness } = buildOk();
    const composition = buildPortfolioComposition(portfolio, summary, marketFreshness);
    expect(composition.showAllocationChart).toBe(false);
  });
});
