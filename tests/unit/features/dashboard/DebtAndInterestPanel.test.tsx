import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildDashboardViewModel,
  buildDebtAndInterestPanel,
  DebtAndInterestPanel,
} from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Debt and Interest Panel — 06_TASKS.md M5-013.
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

function buildPanel() {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  if (!record.summary.ok) throw new Error('expected a successful summary');
  const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
  if (!viewModel.ok) throw new Error('expected a successful view model');
  return buildDebtAndInterestPanel(
    record.portfolio,
    record.summary.data,
    viewModel.freshness.protocol,
  );
}

describe('DebtAndInterestPanel — Display list', () => {
  it('renders total debt, borrow rate, and all three interest cost figures', () => {
    render(<DebtAndInterestPanel panel={buildPanel()} />);
    expect(screen.getByText('Total Debt')).toBeInTheDocument();
    expect(screen.getByText('$20,000.00')).toBeInTheDocument();
    expect(screen.getByText('Current Borrow Rate')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument();
    expect(screen.getByText('Annual Interest Cost')).toBeInTheDocument();
    expect(screen.getByText('Monthly Interest Cost')).toBeInTheDocument();
    expect(screen.getByText('Daily Interest Cost')).toBeInTheDocument();
  });

  it('renders the rate source', () => {
    render(<DebtAndInterestPanel panel={buildPanel()} />);
    expect(screen.getByText(/Rate source: manual/)).toBeInTheDocument();
  });
});

describe('DebtAndInterestPanel — Projected debt is not rendered (Conflict #7)', () => {
  it('never mentions a projection', () => {
    render(<DebtAndInterestPanel panel={buildPanel()} />);
    expect(screen.queryByText(/[Pp]rojected/)).not.toBeInTheDocument();
  });
});
