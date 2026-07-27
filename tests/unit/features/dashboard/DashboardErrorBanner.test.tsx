import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDashboardViewModel, DashboardErrorBanner } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Dashboard Error Banner — 06_TASKS.md M5-021.
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
    collateral: { asset: 'BTC', quantity: 0 },
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

describe('DashboardErrorBanner', () => {
  it('renders the message, error code, and all three recovery actions', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    if (viewModel.ok) throw new Error('expected a calculation failure for this fixture');

    render(
      <DashboardErrorBanner
        portfolioId={created.data.id}
        portfolio={record.portfolio}
        viewModel={viewModel}
      />,
    );

    expect(screen.getByText(/Unable to calculate a summary/)).toBeInTheDocument();
    expect(screen.getByText(/Error code:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Return to Portfolio to fix the underlying data' }),
    ).toHaveAttribute('href', '/portfolio');
    expect(screen.getByRole('button', { name: 'Download recovery copy' })).toBeInTheDocument();
  });

  it('announces itself as an alert, so a screen reader is notified without requiring focus (M5-024, Batch 13)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    if (viewModel.ok) throw new Error('expected a calculation failure for this fixture');

    render(
      <DashboardErrorBanner
        portfolioId={created.data.id}
        portfolio={record.portfolio}
        viewModel={viewModel}
      />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('Download recovery copy triggers a real download, matching M4-017 own test pattern', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
    if (viewModel.ok) throw new Error('expected a calculation failure for this fixture');

    const user = userEvent.setup();
    render(
      <DashboardErrorBanner
        portfolioId={created.data.id}
        portfolio={record.portfolio}
        viewModel={viewModel}
      />,
    );

    const click = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') element.click = click;
      return element;
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    await user.click(screen.getByRole('button', { name: 'Download recovery copy' }));
    expect(click).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
