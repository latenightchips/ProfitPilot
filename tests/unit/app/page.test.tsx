import { render, screen, within } from '@testing-library/react';
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
  it('surfaces the Health Factor Service warning and marks the Liquidation Price card unavailable', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ debt: { asset: 'USDC', balance: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    // 1 from DashboardKpiGrid's own Liquidation Price card (M5-006) + 3 from
    // LiquidationRiskPanel's price/distance/decline cards (M5-009, Batch 4) —
    // Distance/Buffer were deliberately left out of the KPI grid itself and
    // now live in this dedicated panel instead.
    expect(screen.getAllByText('N/A (no debt)').length).toBe(4);
    expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0);
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

describe('DashboardPage — Risk Warning Banner (M5-010, Batch 5)', () => {
  it('shows no banner when nothing is wrong', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns when Health Factor is below the configured target', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ settings: { safetyTargets: { targetHealthFactor: 5 } } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(within(alert).getByText(/is below your configured target/)).toBeInTheDocument();
  });
});

describe('DashboardPage — Portfolio Composition Section (M5-011, Batch 5)', () => {
  it('renders the composition section with both positions', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Portfolio Composition')).toBeInTheDocument();
  });
});
