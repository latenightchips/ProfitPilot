import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppHeader } from '@/components/layout/AppHeader';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Active Portfolio Switching — 06_TASKS.md M4-010.
 *
 * `usePortfolioStore` is a module-level Zustand singleton — reset to
 * initial state before each test.
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

function validInput(name: string) {
  return {
    name,
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
  };
}

describe('AppHeader — no portfolios (M4-010)', () => {
  it('shows a link to create a portfolio when none exist', () => {
    render(<AppHeader />);
    expect(screen.getByText(/no portfolios yet/i)).toBeInTheDocument();
  });

  it('does not render the portfolio switcher when none exist', () => {
    render(<AppHeader />);
    expect(screen.queryByLabelText('Active portfolio')).not.toBeInTheDocument();
  });
});

describe('AppHeader — with portfolios (M4-010)', () => {
  it('lists every active (non-archived) portfolio in the switcher', () => {
    usePortfolioStore.getState().create(validInput('Alpha'));
    usePortfolioStore.getState().create(validInput('Beta'));
    render(<AppHeader />);
    const select = screen.getByLabelText('Active portfolio');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
  });

  it('excludes archived portfolios from the switcher (M4-012: "Hide from active lists")', () => {
    const alpha = usePortfolioStore.getState().create(validInput('Alpha'));
    usePortfolioStore.getState().create(validInput('Beta'));
    if (!alpha.ok) throw new Error('setup failed');
    usePortfolioStore.getState().archive(alpha.data.id);
    render(<AppHeader />);
    expect(screen.queryByRole('option', { name: 'Alpha' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta' })).toBeInTheDocument();
  });

  it('switching the select changes the active portfolio in the store', async () => {
    const first = usePortfolioStore.getState().create(validInput('Alpha'));
    const second = usePortfolioStore.getState().create(validInput('Beta'));
    if (!first.ok || !second.ok) throw new Error('setup failed');

    render(<AppHeader />);
    const user = userEvent.setup();
    const select = screen.getByLabelText('Active portfolio');
    await user.selectOptions(select, second.data.id);

    expect(usePortfolioStore.getState().activePortfolioId).toBe(second.data.id);
  });

  it('renders a "Manage portfolios" link once a portfolio is active', () => {
    const created = usePortfolioStore.getState().create(validInput('Alpha'));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<AppHeader />);
    expect(screen.getByText('Manage portfolios')).toBeInTheDocument();
  });
});
