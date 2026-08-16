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
    {
      engineVersion: record.summary.metadata.engineVersion,
      formulaVersion: record.summary.metadata.formulaVersion,
    },
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

describe('DebtAndInterestPanel — Formula ID tooltips (M5-028, Batch 18)', () => {
  it('exposes a Formula ID tooltip on every calculated figure, but not on the raw Current Borrow Rate', () => {
    render(<DebtAndInterestPanel panel={buildPanel()} />);
    expect(screen.getByText('Total Debt').closest('[title]')).toHaveAttribute(
      'title',
      'F-003 — see docs/02_Formulas.md',
    );
    expect(screen.getByText('Annual Interest Cost').closest('[title]')).toHaveAttribute(
      'title',
      'F-032 — see docs/02_Formulas.md',
    );
    expect(screen.getByText('Monthly Interest Cost').closest('[title]')).toHaveAttribute(
      'title',
      'F-031 — see docs/02_Formulas.md',
    );
    expect(screen.getByText('Daily Interest Cost').closest('[title]')).toHaveAttribute(
      'title',
      'F-030 — see docs/02_Formulas.md',
    );
    expect(screen.getByText('Current Borrow Rate').closest('[title]')).toBeNull();
  });

  it('is keyboard-focusable on every tooltipped figure, so each tooltip is reachable without a mouse', () => {
    render(<DebtAndInterestPanel panel={buildPanel()} />);
    for (const label of [
      'Total Debt',
      'Annual Interest Cost',
      'Monthly Interest Cost',
      'Daily Interest Cost',
    ]) {
      expect(screen.getByText(label).closest('[title]')).toHaveAttribute('tabIndex', '0');
    }
  });
});

describe('DebtAndInterestPanel — zero debt (M5-025, Batch 15)', () => {
  it('renders every debt and interest figure as exactly $0.00, not N/A or NaN', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ debt: { asset: 'USDC', balance: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    if (!record.summary.ok) throw new Error('expected a successful summary');
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    if (!viewModel.ok) throw new Error('expected a successful view model');
    const panel = buildDebtAndInterestPanel(
      record.portfolio,
      record.summary.data,
      viewModel.freshness.protocol,
      {
        engineVersion: record.summary.metadata.engineVersion,
        formulaVersion: record.summary.metadata.formulaVersion,
      },
    );

    render(<DebtAndInterestPanel panel={panel} />);

    expect(screen.getAllByText('$0.00').length).toBe(4);
  });
});
