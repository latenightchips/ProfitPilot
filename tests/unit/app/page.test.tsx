import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import DashboardPage from '@/app/page';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Dashboard Route — 06_TASKS.md M5-001. DoD: "The Dashboard route
 * renders safely for every portfolio state." Mirrors
 * `tests/unit/app/portfolio/page.test.tsx`'s own state-coverage
 * convention (no portfolio / valid portfolio / calculation failure).
 */
const INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_STATE);
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

describe('DashboardPage — no active portfolio', () => {
  it('guides the user to select or create one, rather than redirecting', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/No portfolio is currently selected/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Select or create one' })).toHaveAttribute(
      'href',
      '/portfolios',
    );
  });
});

describe('DashboardPage — valid portfolio (M5-003 pipeline)', () => {
  it('renders the portfolio name and its calculated metrics', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('My Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Net Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('$80,000.00')).toBeInTheDocument();
    expect(screen.getByText('Health Factor')).toBeInTheDocument();
  });

  it('renders the Summary Header (M5-004) with a Refresh action and an Edit Portfolio link', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Portfolio' })).toHaveAttribute(
      'href',
      '/portfolio',
    );
    expect(screen.getByText(/Storage: Saved/)).toBeInTheDocument();
  });
});

describe('DashboardPage — zero-debt portfolio warnings (Conflict #20)', () => {
  it('surfaces the Health Factor Service warning and marks liquidation metrics unavailable', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ debt: { asset: 'USDC', balance: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getAllByText('N/A (no debt)').length).toBe(3);
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    expect(record.summary.ok && record.summary.warnings.length > 0).toBe(true);
  });
});

describe('DashboardPage — calculation failure', () => {
  it('renders a safe error state instead of a blank or crashed page', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText(/Unable to calculate a summary/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Return to Portfolio to fix the underlying data' }),
    ).toHaveAttribute('href', '/portfolio');
  });

  it('still shows the Summary Header — identity is not gated on calculation success (M5-004)', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('My Portfolio')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});
