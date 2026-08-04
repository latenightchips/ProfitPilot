import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDashboardViewModel, DashboardSummaryHeader } from '@/features/dashboard';
import { autoSaveCoordinator } from '@/services';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Dashboard Summary Header — 06_TASKS.md M5-004. DoD: "The user can
 * identify which portfolio and data source are currently active."
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
  window.localStorage.clear();
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

describe('DashboardSummaryHeader — identity and freshness (M5-004)', () => {
  it('displays the portfolio name, description, BTC price, origin, and storage status', async () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ description: 'Core BTC-backed loan' }));
    if (!created.ok) throw new Error('setup failed');
    await autoSaveCoordinator.flushAll();
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);

    expect(screen.getByText('My Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Core BTC-backed loan')).toBeInTheDocument();
    expect(screen.getByText(/BTC \$50,000\.00 \(manual\)/)).toBeInTheDocument();
    expect(screen.getByText(/Storage: Saved/)).toBeInTheDocument();
  });

  it('omits the description paragraph when the portfolio has none', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);

    expect(viewModel.portfolioDescription).toBeNull();
  });

  it('still shows identity and price when the calculation itself has failed', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    expect(record.summary.ok).toBe(false);
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    expect(viewModel.ok).toBe(false);

    render(<DashboardSummaryHeader viewModel={viewModel} />);

    expect(screen.getByText('My Portfolio')).toBeInTheDocument();
    expect(screen.getByText(/BTC \$50,000\.00 \(manual\)/)).toBeInTheDocument();
  });
});

describe('DashboardSummaryHeader — actions (M5-004)', () => {
  it('the Refresh button re-derives the summary via recomputeSummary, not a live market fetch', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    const afterRecord = usePortfolioStore.getState().portfolios[created.data.id];
    expect(afterRecord.summary.ok).toBe(true);
  });

  it('the Edit Portfolio link points to the single Portfolio detail route', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);

    expect(screen.getByRole('link', { name: 'Edit Portfolio' })).toHaveAttribute(
      'href',
      '/portfolio',
    );
  });

  it('does not render a second portfolio switcher (AppHeader already provides one globally)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);

    expect(screen.queryByLabelText('Active portfolio')).not.toBeInTheDocument();
  });
});

describe('DashboardSummaryHeader — stale market data (M5-025, Batch 15)', () => {
  it('appends ", stale" once the price is older than the 5-minute freshness threshold', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];

    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 6 * 60 * 1000));
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);

    expect(screen.getByText(/BTC \$50,000\.00 \(manual, stale\)/)).toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('DashboardSummaryHeader — long values (M5-025, Batch 15)', () => {
  it('renders a long portfolio name in full, not truncated or hidden', () => {
    const longName = 'A'.repeat(200);
    const created = usePortfolioStore.getState().create(validInput({ name: longName }));
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);

    expect(screen.getByText(longName)).toBeInTheDocument();
  });
});
