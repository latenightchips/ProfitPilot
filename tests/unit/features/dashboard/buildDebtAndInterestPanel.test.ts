import { beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardViewModel, buildDebtAndInterestPanel } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Debt and Interest Panel builder — 06_TASKS.md M5-013.
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
    protocolFreshness: viewModel.freshness.protocol,
  };
}

describe('buildDebtAndInterestPanel — real Service outputs, not derived approximations', () => {
  it('formats total debt, borrow rate, and annual/monthly/daily interest cost', () => {
    const { portfolio, summary, protocolFreshness } = buildOk();
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness);

    expect(panel.formattedTotalDebt).toBe('$20,000.00');
    expect(panel.formattedCurrentBorrowRate).toBe('5%');
    expect(panel.formattedAnnualInterestCost).toBe('$1,000.00');
    // Daily = 20000 * 0.05 / 365 ≈ 2.7397; Monthly = Daily * 30 ≈ 82.19
    expect(panel.formattedDailyInterestCost).toBe('$2.74');
    expect(panel.formattedMonthlyInterestCost).toBe('$82.19');
  });

  it('monthly interest is not annual/12 — proves the real F-030/F-031 chain is used', () => {
    const { portfolio, summary, protocolFreshness } = buildOk();
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness);
    expect(panel.formattedMonthlyInterestCost).not.toBe('$83.33');
  });

  it('reports the rate source from protocol freshness', () => {
    const { portfolio, summary, protocolFreshness } = buildOk();
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness);
    expect(panel.rateSource).toBe('manual');
  });
});

describe('buildDebtAndInterestPanel — zero-debt portfolio', () => {
  it('reports zero interest costs without failing', () => {
    const { portfolio, summary, protocolFreshness } = buildOk({
      debt: { asset: 'USDC', balance: 0 },
    });
    const panel = buildDebtAndInterestPanel(portfolio, summary, protocolFreshness);
    expect(panel.formattedTotalDebt).toBe('$0.00');
    expect(panel.formattedDailyInterestCost).toBe('$0.00');
    expect(panel.formattedMonthlyInterestCost).toBe('$0.00');
  });
});
