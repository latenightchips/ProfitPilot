import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildDashboardViewModel, DashboardKpiGrid } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Core KPI Grid — 06_TASKS.md M5-006. Renders exactly the task's own
 * 8-item "Cards" list — not the 10 metrics `DashboardMetrics` (M5-003)
 * carries, since `liquidationDistance`/`liquidationBuffer` belong to
 * M5-009's own, later, dedicated Liquidation Risk Panel instead.
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

function buildOkViewModel(overrides: Record<string, unknown> = {}) {
  const created = usePortfolioStore.getState().create(validInput(overrides));
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
  if (!viewModel.ok) throw new Error('expected a successful view model');
  return viewModel;
}

describe('DashboardKpiGrid — the 8 named cards (M5-006)', () => {
  it('renders exactly the Cards this task names, each with its Service-derived value', () => {
    const viewModel = buildOkViewModel();

    render(<DashboardKpiGrid metrics={viewModel.metrics} />);

    const expectedTitles = [
      'Net Portfolio Value',
      'Total Collateral',
      'Total Debt',
      'Health Factor',
      'Loan-to-Value',
      'Effective Leverage',
      'Annual Interest Cost',
      'Liquidation Price',
    ];
    for (const title of expectedTitles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    expect(screen.getByText('$80,000.00')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('does not render Distance to Liquidation or Liquidation Buffer (M5-009 territory, not this grid)', () => {
    const viewModel = buildOkViewModel();

    render(<DashboardKpiGrid metrics={viewModel.metrics} />);

    expect(screen.queryByText('Distance to Liquidation')).not.toBeInTheDocument();
    expect(screen.queryByText('Liquidation Buffer')).not.toBeInTheDocument();
  });

  it('attaches each card’s already-documented Formula ID as its tooltip', () => {
    const viewModel = buildOkViewModel();

    render(<DashboardKpiGrid metrics={viewModel.metrics} />);

    expect(screen.getByText('Health Factor').closest('[title]')).toHaveAttribute(
      'title',
      'F-022 — see docs/02_Formulas.md',
    );
  });
});

describe('DashboardKpiGrid — unavailable values (Conflict #20)', () => {
  it('marks the Liquidation Price card unavailable, clearly, on a zero-debt portfolio', () => {
    const viewModel = buildOkViewModel({ debt: { asset: 'USDC', balance: 0 } });

    render(<DashboardKpiGrid metrics={viewModel.metrics} />);

    expect(screen.getByText('N/A (no debt)')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });
});
