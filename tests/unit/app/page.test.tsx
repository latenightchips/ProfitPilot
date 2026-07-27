import { act, render, screen, within } from '@testing-library/react';
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
    // Also rendered by Leverage Summary's own "Net Equity" (M5-014, Batch 6),
    // the identical Service value under a second, separately-worded label.
    expect(screen.getAllByText('$80,000.00').length).toBeGreaterThan(0);
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

  it('shows the No-Debt Notice explaining the empty state (M5-020, Batch 9)', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ debt: { asset: 'USDC', balance: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText(/This portfolio has no debt position/)).toBeInTheDocument();
  });
});

describe('DashboardPage — Loading Skeleton (M5-019, Batch 9)', () => {
  it('renders the skeleton exclusively while loadStatus is "loading", never alongside other content', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);
    expect(screen.getByText('My Portfolio')).toBeInTheDocument();

    act(() => {
      usePortfolioStore.setState({ loadStatus: 'loading' });
    });

    expect(screen.getByRole('status', { name: 'Loading Dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('My Portfolio')).not.toBeInTheDocument();
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

  it('offers Retry, an error code, and a recovery-copy download (M5-021, Batch 10)', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByText(/Error code:/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download recovery copy' })).toBeInTheDocument();
  });

  it('Retry re-runs the calculation without crashing (M5-021, Batch 10)', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);
    screen.getByRole('button', { name: 'Retry' }).click();

    // Reproduces the same failure, since the underlying data is unchanged —
    // matching M4-017's own already-established finding for the Portfolio page.
    expect(screen.getByText(/Unable to calculate a summary/)).toBeInTheDocument();
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

describe('DashboardPage — Debt and Interest Panel (M5-013, Batch 6)', () => {
  it('renders the panel with total debt and interest cost figures', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Debt and Interest')).toBeInTheDocument();
    expect(screen.getByText('Monthly Interest Cost')).toBeInTheDocument();
    expect(screen.getByText('Daily Interest Cost')).toBeInTheDocument();
  });
});

describe('DashboardPage — Leverage Summary Section (M5-014, Batch 6)', () => {
  it('renders the leverage summary with a plain-language explanation', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Leverage Summary')).toBeInTheDocument();
    expect(screen.getByText(/This portfolio is leveraged/)).toBeInTheDocument();
  });
});

describe('DashboardPage — Data Freshness Section (M5-017, Batch 8)', () => {
  it('renders freshness indicators for both market price and protocol parameters', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Data Freshness')).toBeInTheDocument();
    expect(screen.getByText('BTC Price:')).toBeInTheDocument();
    expect(screen.getByText('Protocol Parameters:')).toBeInTheDocument();
  });

  it('still renders freshness indicators when the calculation fails', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Data Freshness')).toBeInTheDocument();
  });
});

describe('DashboardPage — Quick Actions Section (M5-016, Batch 11)', () => {
  it('renders available and unavailable actions, and export links, for a healthy portfolio', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit portfolio' })).toHaveAttribute(
      'href',
      '/portfolio',
    );
    expect(screen.getByRole('button', { name: 'Run simulation' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Export portfolio (JSON)' })).toBeInTheDocument();
  });

  it('still renders Quick Actions, with Export disabled, when the calculation fails', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit portfolio' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export portfolio' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('DashboardPage — Recommendation Summary Section (M5-015, Batch 7; empty state Batch 9)', () => {
  it('explains the empty state when no target is configured, per M5-020', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    // "No target Health Factor is configured" alone also matches
    // HealthFactorStatusSection's own explanation text (M5-007, Batch 4) —
    // this substring is unique to the Recommendations empty state.
    expect(screen.getByText(/so no recommendations can be generated/)).toBeInTheDocument();
  });

  it('renders recommendations when Health Factor is below the configured target', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ settings: { safetyTargets: { targetHealthFactor: 5 } } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Priority 1')).toBeInTheDocument();
  });
});
