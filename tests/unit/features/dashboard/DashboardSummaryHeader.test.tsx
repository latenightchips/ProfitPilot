import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDashboardViewModel, DashboardSummaryHeader } from '@/features/dashboard';
import { autoSaveCoordinator } from '@/services';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Dashboard Summary Header — 06_TASKS.md M5-004. DoD: "The user can
 * identify which portfolio and data source are currently active."
 *
 * **Dashboard Live-State Cleanup batch**: "Refresh" now also reads
 * `useAaveLiveDataStore.fetchLiveAaveData` directly (not just
 * `usePortfolioStore.recomputeSummary`) — the store's real
 * `fetchLiveAaveData` calls actual `fetch()`, so every test below stubs
 * it with a mock before rendering, the same convention
 * `tests/unit/app/portfolio/page.test.tsx`/`tests/unit/app/page.test.tsx`
 * already established.
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
  useAaveLiveDataStore.setState({
    status: 'idle',
    marketQuote: null,
    protocolQuote: null,
    collateralSymbol: null,
    borrowSymbol: null,
    source: null,
    errorMessage: null,
    fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
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

describe('DashboardSummaryHeader — actions (Dashboard Live-State Cleanup batch)', () => {
  it('the Refresh button both fetches a live Aave snapshot and immediately re-derives the summary', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    // Fetches live Aave data — no longer a claim this button doesn't make.
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledTimes(1);
    // Still recomputes synchronously against whatever is currently stored,
    // rather than only after the async fetch above resolves.
    const afterRecord = usePortfolioStore.getState().portfolios[created.data.id];
    expect(afterRecord.summary.ok).toBe(true);
  });

  it("the Refresh button fetches live data for the portfolio's own debt asset, not a hardcoded default (USDT Support milestone)", async () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ debt: { asset: 'USDT', balance: 20000 } }));
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDT');
  });

  it('the Refresh button still fetches USDC for a USDC-debt portfolio (unchanged behavior)', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);

    render(<DashboardSummaryHeader viewModel={viewModel} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDC');
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
