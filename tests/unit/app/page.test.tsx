import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardPage from '@/app/page';
import { autoSaveCoordinator } from '@/services';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { useDeveloperModeStore } from '@/stores/developerModeStore';
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

/**
 * Portfolio Live-State Cleanup batch — `DashboardPageClient` now also
 * mounts `hooks/useAaveLiveSync.ts` (fetches live Aave data independently
 * of the Portfolio page). Stubbing a `'ready'` quote matching
 * `validInput()`'s own `market`/`protocol` defaults keeps the live-sync
 * equality gate a no-op for every pre-existing test below, and avoids an
 * unmocked real `fetch()` call during render.
 */
function matchingAaveLiveState(
  overrides: Partial<ReturnType<typeof useAaveLiveDataStore.getState>> = {},
) {
  return {
    status: 'ready' as const,
    marketQuote: {
      asset: 'BTC',
      currency: 'USD',
      freshness: 'fresh' as const,
      price: 50000,
      origin: 'provider' as const,
      timestamp: new Date().toISOString(),
    },
    protocolQuote: {
      available: true as const,
      collateralAsset: 'WBTC',
      borrowAsset: 'USDC',
      parameters: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      origin: 'live' as const,
      timestamp: new Date().toISOString(),
    },
    collateralSymbol: 'WBTC',
    borrowSymbol: 'USDC',
    source: {
      protocol: 'aave' as const,
      version: 'v3' as const,
      network: 'Ethereum Mainnet',
      method: 'rpc' as const,
      blockNumber: '21000000',
    },
    errorMessage: null,
    fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  // `load: async () => {}` prevents DashboardPage's own mount effect
  // (a pre-existing `useEffect(() => { load(); }, [load])`) from
  // overwriting each test's manually seeded state with whatever the
  // real, now-async `load()` (M8-008) reads from local storage — these
  // tests exercise the Dashboard's rendering logic directly, not
  // hydration itself (covered by `stores/portfolioStore.test.ts`).
  usePortfolioStore.setState({ ...INITIAL_STATE, load: async () => {} });
  useDeveloperModeStore.setState({ enabled: false });
  useAaveLiveDataStore.setState(matchingAaveLiveState());
  useAaveV4LiveDataStore.setState({
    status: 'idle',
    engineInputs: null,
    userAddress: null,
    debtAsset: null,
    errorMessage: null,
    // V4 Readiness Audit §12 Stage 17 — defaults to "just fetched" so the
    // existing `{ status: 'ready' }` override below still reads as
    // fresh/live, not stale.
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
  });
  // V4 Readiness Audit §12 Stage 23F — same role as the V4 debt-state
  // reset above, one store over.
  useAaveV4CollateralRiskLiveDataStore.setState({
    status: 'idle',
    canonical: null,
    userAddress: null,
    errorMessage: null,
    lastFetchedAt: new Date().toISOString(),
    fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
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

  it('renders the Summary Header (M5-004) with a Refresh action and an Edit Portfolio link', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    await autoSaveCoordinator.flushAll();

    render(<DashboardPage />);

    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit Portfolio' })).toHaveAttribute(
      'href',
      '/portfolio',
    );
    expect(screen.getByText(/Storage: Saved/)).toBeInTheDocument();
  });

  it('labels the same F-024 figure identically on the KPI Grid and the Liquidation Risk Panel (M9-055)', () => {
    // 06_TASKS.md M9-055 ("Audit In-Application Financial Disclosures")
    // found these two cards disagreeing on whether to hedge this
    // calculated, forward-looking price as an estimate — DashboardKpiGrid
    // said "Liquidation Price," LiquidationRiskPanel said "Estimated
    // Liquidation Price," for the identical number on the identical page.
    // Both must now read "Estimated Liquidation Price," and only that.
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getAllByText('Estimated Liquidation Price')).toHaveLength(2);
    expect(screen.queryByText('Liquidation Price', { exact: true })).not.toBeInTheDocument();
  });
});

describe('DashboardPage — zero-debt portfolio warnings (Conflict #20)', () => {
  it('surfaces the Health Factor Service warning and marks the Estimated Liquidation Price card unavailable', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ debt: { asset: 'USDC', balance: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    // 1 from DashboardKpiGrid's own Estimated Liquidation Price card
    // (M5-006/M9-055) + 3 from LiquidationRiskPanel's price/distance/decline
    // cards (M5-009, Batch 4) —
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
  it('renders every navigation action as a real link, and export links, for a healthy portfolio (M9-017 fix — see buildQuickActions.ts)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit portfolio' })).toHaveAttribute(
      'href',
      '/portfolio',
    );
    expect(screen.getByRole('link', { name: 'Run simulation' })).toHaveAttribute(
      'href',
      '/simulation',
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

describe('DashboardPage — independent live Aave sync (Portfolio Live-State Cleanup batch)', () => {
  it('fetches live Aave data on mount, independently of the Portfolio page', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalled();
  });

  it('shows the Aave V3 · Live status badge when the live fetch is fresh', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Aave V3 · Live')).toBeInTheDocument();
  });

  it('shows the Aave V3 · Unavailable badge, without crashing, when no live fetch has ever succeeded', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    useAaveLiveDataStore.setState({
      status: 'error',
      marketQuote: null,
      protocolQuote: null,
      collateralSymbol: null,
      borrowSymbol: null,
      source: null,
      errorMessage: 'Live Aave data is temporarily unavailable.',
      fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
    });

    render(<DashboardPage />);

    expect(screen.getByText(/Aave V3 · Unavailable/)).toBeInTheDocument();
  });
});

describe('DashboardPage — one coherent live source of truth (Dashboard Live-State Cleanup batch)', () => {
  it('never labels a live-synced BTC price "(manual)" in the Summary Header', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    // The exact bug reported: Portfolio shows live data while Dashboard's
    // Summary Header still says "(manual)" for the identical, currently
    // Aave-synced value — buildDashboardViewModel.ts's own header comment
    // documents why this happened and how the live snapshot fixes it.
    expect(screen.queryByText(/\(manual\)/)).not.toBeInTheDocument();
    expect(screen.getByText(/\(provider\)/)).toBeInTheDocument();
  });

  it('never renders the "(manual entry)" Data Freshness callout for a live-synced portfolio', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.queryByText('(manual entry)')).not.toBeInTheDocument();
  });

  it('falls back to "cache," not "manual," and still shows the last-known price (never blanked) when live data has never successfully loaded', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    useAaveLiveDataStore.setState({
      status: 'error',
      marketQuote: null,
      protocolQuote: null,
      collateralSymbol: null,
      borrowSymbol: null,
      source: null,
      errorMessage: 'Live Aave data is temporarily unavailable.',
      fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
    });

    render(<DashboardPage />);

    expect(screen.queryByText(/\(manual\)/)).not.toBeInTheDocument();
    expect(screen.getByText(/BTC \$50,000\.00 \(cache/)).toBeInTheDocument();
  });

  it('the Refresh button fetches live Aave data without altering collateral quantity or debt amount', async () => {
    const created = usePortfolioStore.getState().create(
      validInput({
        collateral: { asset: 'BTC', quantity: 2 },
        debt: { asset: 'USDC', balance: 20000 },
      }),
    );
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    const user = userEvent.setup();

    render(<DashboardPage />);
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalled();
    const afterPortfolio = usePortfolioStore.getState().portfolios[created.data.id].portfolio;
    expect(afterPortfolio.collateral.quantity).toBe(2);
    expect(afterPortfolio.debt.asset).toBe('USDC');
    expect(afterPortfolio.debt.balance).toBe(20000);
  });

  it('the Rate source shown for Debt and Interest reads "live," not "manual," when Aave data is live-synced', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Rate source: live')).toBeInTheDocument();
    expect(screen.queryByText('Rate source: manual')).not.toBeInTheDocument();
  });
});

describe('DashboardPage — Developer Mode Toggle (M5-022, Batch 14)', () => {
  it('renders the toggle unchecked by default and shows no developer details', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByRole('checkbox', { name: 'Developer Mode' })).not.toBeChecked();
    expect(screen.queryByText(/Formula ID:/)).not.toBeInTheDocument();
  });

  it('reveals Formula IDs and raw values once toggled on', async () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    const user = userEvent.setup();
    render(<DashboardPage />);

    await user.click(screen.getByRole('checkbox', { name: 'Developer Mode' }));

    expect(screen.getByText(/Formula ID: F-004/)).toBeInTheDocument();
    expect(screen.getByText(/Raw value: 80000/)).toBeInTheDocument();
  });
});

const V4_ADDRESS = '0x1234567890123456789012345678901234567890';

/**
 * Protocol version labeling — V4 Readiness Audit §12 Stage 13. Mirrors
 * `app/portfolio/page.test.tsx`'s own badge coverage for the Portfolio
 * page's Debt section, at the Dashboard's own single summary badge.
 */
describe('DashboardPage — Aave protocol version labeling (Stage 13)', () => {
  it('shows the unchanged V3 label for a portfolio with protocolVersion unset', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText('Aave V3 · Live')).toBeInTheDocument();
  });

  it('shows "Aave V4 · Waiting for address" for a V4 portfolio with no address set', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');

    render(<DashboardPage />);

    expect(screen.getByText('Aave V4 · Waiting for address')).toBeInTheDocument();
  });

  it('shows "Aave V4 · Live" once an address is set, the live fetch is ready, and v4DebtState is present', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(created.data.id, { userAddress: V4_ADDRESS });
    usePortfolioStore.getState().setAaveV4DebtState(created.data.id, {
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    useAaveV4LiveDataStore.setState({ status: 'ready' });
    // V4 Readiness Audit §12 Stage 23F — "Live" now also requires
    // collateral-risk sync to be ready and the portfolio's own
    // `v4CollateralRisk` to be set (mirroring the pre-existing `v4DebtState` guard).
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(created.data.id, { collateralFactor: 0.8, dynamicConfigKey: 1 });
    useAaveV4CollateralRiskLiveDataStore.setState({ status: 'ready' });

    render(<DashboardPage />);

    // V4 Mixed-Provenance UX batch — the composite `'live'` state no
    // longer renders as one collapsed "Aave V4 · Live" string; the
    // truthful per-dimension breakdown is asserted instead (see
    // `tests/unit/app/portfolio/page.test.tsx`'s identical fix for the
    // full reasoning).
    expect(screen.getByText('Debt position Live')).toBeInTheDocument();
    expect(screen.getByText('Collateral risk Live')).toBeInTheDocument();
  });
});

/**
 * Refresh route isolation — V4 Readiness Audit §12 Stage 13's own
 * instruction: "V3 Refresh never calls the V4 route" / "V4 Refresh never
 * calls the V3 route." `useAaveLiveSync`/`useAaveV4LiveSync` are two
 * structurally separate hooks calling two separate Store fetch
 * functions to two separate API routes — this test proves the *gating*
 * half of that guarantee holds at the page level (the route URLs
 * themselves are already covered by each Store's own unit tests).
 */
describe('DashboardPage — V3/V4 live-sync route isolation (Stage 13)', () => {
  it('never calls the V4 fetch function for a V3/unset portfolio (no address to fetch)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
  });

  it('calls the V4 fetch function (never the V3 one with V4 parameters) once a V4 address is set, while V3’s own fetch still runs independently', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(created.data.id, { userAddress: V4_ADDRESS });

    render(<DashboardPage />);

    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
      V4_ADDRESS,
      'USDC',
    );
    // V3's own unconditional fetch is unaffected by the portfolio being V4.
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalledWith('USDC');
    // V4 Readiness Audit §12 Stage 23F — collateral-risk sync fires
    // alongside debt-state sync on this same direct-navigation path,
    // closing the Stage 23E blocker for Dashboard specifically.
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).toHaveBeenCalledWith(V4_ADDRESS);
  });
});

/**
 * Dashboard V3/V4 Semantic Isolation audit — DOM-level regression coverage.
 * "We must not expose V3-only terminology or assumptions as though they
 * describe V4." Builds on the same fully-live V4 fixture the "Aave
 * protocol version labeling" describe block above already established
 * (address set, debt state + collateral risk both synced and ready), so
 * every panel that depends on a successful summary (Portfolio
 * Composition, Liquidation Risk) actually renders its real content
 * instead of an "unavailable" placeholder.
 */
function selectFullyLiveV4Portfolio(): string {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(created.data.id);
  usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
  usePortfolioStore.getState().setAaveV4Position(created.data.id, { userAddress: V4_ADDRESS });
  usePortfolioStore.getState().setAaveV4DebtState(created.data.id, {
    drawnDebt: 15000,
    premiumDebt: 500,
    baseDrawnApr: 0.05,
    riskPremium: 0.01,
    debtAssetPriceUsd: 1.0,
  });
  useAaveV4LiveDataStore.setState({ status: 'ready' });
  usePortfolioStore
    .getState()
    .setAaveV4CollateralRisk(created.data.id, { collateralFactor: 0.8, dynamicConfigKey: 1 });
  useAaveV4CollateralRiskLiveDataStore.setState({ status: 'ready' });
  return created.data.id;
}

describe('DashboardPage — V3/V4 semantic isolation (Dashboard V3/V4 Semantic Isolation audit)', () => {
  it('a V4 portfolio never renders a live Supply APR value or the V3-only assumptions-copy phrase — the always-rendered Supply APR Trend heading (v1.14.0 Batch 3, same as Borrow APR Trend) is the sole exception, and it never shows a fabricated V4 percentage', () => {
    selectFullyLiveV4Portfolio();
    render(<DashboardPage />);

    // The trend section heading renders for every portfolio, V3 or V4 —
    // identical to `BorrowAprTrendSection`'s own precedent, which has no
    // equivalent blanket-absence assertion in this suite.
    expect(screen.getByRole('heading', { level: 3, name: 'Supply APR Trend' })).toBeInTheDocument();
    // The V3-only assumptions-copy phrase this test originally protected
    // against (see the "Supply APR: 2%" control assertion below) must
    // still never appear for a V4 portfolio.
    expect(screen.queryByText(/Supply APR: \d/)).not.toBeInTheDocument();
  });

  it('a V4 portfolio never renders "Maximum LTV" or "Liquidation Threshold" — shows "Collateral Factor" instead', () => {
    selectFullyLiveV4Portfolio();
    render(<DashboardPage />);

    expect(screen.queryByText(/Maximum LTV/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Liquidation Threshold/)).not.toBeInTheDocument();
    expect(screen.getByText(/Collateral Factor: 80%/)).toBeInTheDocument();
  });

  it("a V4 portfolio's Liquidation Risk assumptions copy names collateral factor, never borrow/supply APR or max LTV/liquidation threshold", () => {
    selectFullyLiveV4Portfolio();
    render(<DashboardPage />);

    expect(screen.getByText(/Aave V4 collateral factor/)).toBeInTheDocument();
    expect(screen.queryByText(/borrow APR, supply APR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/maximum LTV, liquidation threshold/)).not.toBeInTheDocument();
  });

  it('a V4 portfolio\'s refresh note never names "Aave V3"', () => {
    selectFullyLiveV4Portfolio();
    render(<DashboardPage />);

    expect(screen.queryByText(/Aave V3 live snapshot/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Aave V4 debt and collateral-risk data syncs automatically/),
    ).toBeInTheDocument();
  });

  it('control: a V3 (unset protocolVersion) portfolio keeps every existing Dashboard string byte-identical', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText(/Maximum LTV: 75%/)).toBeInTheDocument();
    expect(screen.getByText(/Liquidation Threshold: 80%/)).toBeInTheDocument();
    expect(screen.getByText(/Supply APR: 2%/)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Assumes the current BTC price and protocol parameters (borrow APR, supply APR, maximum LTV, liquidation threshold) remain unchanged. These estimates recalculate automatically whenever the underlying portfolio data changes.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '"Refresh" fetches the latest Aave V3 live snapshot and recalculates your portfolio summary — it cannot fail in a way that erases or replaces your collateral quantity, debt asset, or debt amount.',
      ),
    ).toBeInTheDocument();
  });
});

/**
 * v1.13.0 Batch 4 ("Dashboard Section Grouping") — the `viewModel.ok ===
 * true` branch's own dense stack is now wrapped in four labeled
 * `<section aria-labelledby>` groups (Overview, Health & Risk,
 * Composition & Debt, Recommended Actions), each with its own `<h2>`
 * heading. Purely additive presentation: no child component, prop, or
 * render order changed — see `DashboardPageClient.tsx`'s own updated
 * header comment for the full reasoning.
 *
 * v1.15.0 Batch 1 ("Dashboard Information Architecture — Trends, Part 1")
 * adds a fifth group, "Trends" (positioned after "Composition & Debt" and
 * before "Recommended Actions"), and relocates the four Health & Risk
 * historical trend charts into it. This is an information-architecture-only
 * change: the moved components' own props, data, and render logic are
 * unchanged.
 *
 * v1.15.0 Batch 2 ("Dashboard Information Architecture — Trends, Part 2")
 * relocates the eight Composition & Debt historical trend charts into the
 * same "Trends" group created in Batch 1, alongside the four Health & Risk
 * trend charts already there. Composition & Debt's three current-state
 * panels (Portfolio Composition, Debt and Interest, Leverage Summary) stay
 * in place.
 *
 * v1.15.0 Batch 3 ("Dashboard Information Architecture — Trends, Part 3",
 * final) relocates Overview's last two historical trend charts (Net Worth
 * Trend, Loan-to-Value Trend) into "Trends," completing the separation:
 * Overview, Health & Risk, and Composition & Debt now hold current-state
 * content only, and "Trends" holds all 14 historical trend charts, ordered
 * Overview → Health & Risk → Composition & Debt.
 */
describe('DashboardPage — Section Grouping (v1.13.0 Batch 4)', () => {
  it('renders all five group landmarks with their own accessible heading', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByRole('region', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Health & Risk' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Composition & Debt' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Trends' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Recommended Actions' })).toBeInTheDocument();
  });

  it('renders each group heading as an <h2>, between the page <h1> and every child section’s own existing <h3>', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Health & Risk' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Composition & Debt' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Trends' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Recommended Actions' }),
    ).toBeInTheDocument();
    // A pre-existing child heading, still exactly level 3, unchanged.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Health Factor Status' }),
    ).toBeInTheDocument();
  });

  it('does not collide with RecommendationSummarySection’s own "Recommendations" heading — the group is labeled "Recommended Actions" instead', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    // Exactly one "Recommendations" text node (the child's own <h3>) —
    // proves the group heading did not introduce a duplicate.
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getAllByText('Recommendations')).toHaveLength(1);
  });

  it('places the KPI grid inside the "Overview" region, with its trend charts moved out (v1.15.0 Batch 3)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const overview = within(screen.getByRole('region', { name: 'Overview' }));
    expect(overview.getByText('Net Portfolio Value')).toBeInTheDocument();
    expect(overview.getByText('Health Factor')).toBeInTheDocument();
    expect(
      overview.queryByRole('heading', { level: 3, name: 'Net Worth Trend' }),
    ).not.toBeInTheDocument();
    expect(
      overview.queryByRole('heading', { level: 3, name: 'Loan-to-Value Trend' }),
    ).not.toBeInTheDocument();
  });

  it('places Health Factor Status and Liquidation Risk inside the "Health & Risk" region, with their trend charts moved out (v1.15.0 Batch 1)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const healthRisk = within(screen.getByRole('region', { name: 'Health & Risk' }));
    expect(healthRisk.getByText('Health Factor Status')).toBeInTheDocument();
    expect(healthRisk.getByText('Estimated Liquidation Price')).toBeInTheDocument();
    expect(
      healthRisk.queryByRole('heading', { level: 3, name: 'Health Factor Trend' }),
    ).not.toBeInTheDocument();
    expect(
      healthRisk.queryByRole('heading', { level: 3, name: 'Liquidation Buffer Trend' }),
    ).not.toBeInTheDocument();
    expect(
      healthRisk.queryByRole('heading', { level: 3, name: 'Market Price Trend' }),
    ).not.toBeInTheDocument();
    expect(
      healthRisk.queryByRole('heading', { level: 3, name: 'Liquidation Price Trend' }),
    ).not.toBeInTheDocument();
  });

  it('places the four Health & Risk trend charts inside the new "Trends" region (v1.15.0 Batch 1)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const trends = within(screen.getByRole('region', { name: 'Trends' }));
    expect(
      trends.getByRole('heading', { level: 3, name: 'Health Factor Trend' }),
    ).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Liquidation Buffer Trend' }),
    ).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Market Price Trend' }),
    ).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Liquidation Price Trend' }),
    ).toBeInTheDocument();
  });

  it('places the two Overview trend charts inside the "Trends" region (v1.15.0 Batch 3)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const trends = within(screen.getByRole('region', { name: 'Trends' }));
    expect(trends.getByRole('heading', { level: 3, name: 'Net Worth Trend' })).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Loan-to-Value Trend' }),
    ).toBeInTheDocument();
  });

  it('places Portfolio Composition, Debt and Interest, and Leverage inside the "Composition & Debt" region, with their trend charts moved out (v1.15.0 Batch 2)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const compositionDebt = within(screen.getByRole('region', { name: 'Composition & Debt' }));
    expect(compositionDebt.getByText('Portfolio Composition')).toBeInTheDocument();
    expect(compositionDebt.getByText('Debt and Interest')).toBeInTheDocument();
    expect(compositionDebt.getByText('Leverage Summary')).toBeInTheDocument();
    expect(
      compositionDebt.queryByRole('heading', { level: 3, name: 'Collateral Quantity Trend' }),
    ).not.toBeInTheDocument();
    expect(
      compositionDebt.queryByRole('heading', { level: 3, name: 'Collateral Value Trend' }),
    ).not.toBeInTheDocument();
    expect(
      compositionDebt.queryByRole('heading', { level: 3, name: 'Debt Quantity Trend' }),
    ).not.toBeInTheDocument();
    expect(
      compositionDebt.queryByRole('heading', { level: 3, name: 'Debt Value Trend' }),
    ).not.toBeInTheDocument();
    expect(
      compositionDebt.queryByRole('heading', {
        level: 3,
        name: 'Interest Cost (annualized) Trend',
      }),
    ).not.toBeInTheDocument();
    expect(
      compositionDebt.queryByRole('heading', { level: 3, name: 'Borrow APR Trend' }),
    ).not.toBeInTheDocument();
    expect(
      compositionDebt.queryByRole('heading', { level: 3, name: 'Supply APR Trend' }),
    ).not.toBeInTheDocument();
    expect(
      compositionDebt.queryByRole('heading', { level: 3, name: 'Leverage Trend' }),
    ).not.toBeInTheDocument();
  });

  it('places the eight Composition & Debt trend charts inside the "Trends" region, alongside the Batch 1 Health & Risk trend charts (v1.15.0 Batch 2)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const trends = within(screen.getByRole('region', { name: 'Trends' }));
    // Batch 2 additions.
    expect(
      trends.getByRole('heading', { level: 3, name: 'Collateral Quantity Trend' }),
    ).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Collateral Value Trend' }),
    ).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Debt Quantity Trend' }),
    ).toBeInTheDocument();
    expect(trends.getByRole('heading', { level: 3, name: 'Debt Value Trend' })).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Interest Cost (annualized) Trend' }),
    ).toBeInTheDocument();
    expect(trends.getByRole('heading', { level: 3, name: 'Borrow APR Trend' })).toBeInTheDocument();
    expect(trends.getByRole('heading', { level: 3, name: 'Supply APR Trend' })).toBeInTheDocument();
    expect(trends.getByRole('heading', { level: 3, name: 'Leverage Trend' })).toBeInTheDocument();
    // Batch 1 additions, still present and unaffected by Batch 2.
    expect(
      trends.getByRole('heading', { level: 3, name: 'Health Factor Trend' }),
    ).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Liquidation Buffer Trend' }),
    ).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Market Price Trend' }),
    ).toBeInTheDocument();
    expect(
      trends.getByRole('heading', { level: 3, name: 'Liquidation Price Trend' }),
    ).toBeInTheDocument();
  });

  it('places all 14 historical trend charts inside the single "Trends" region, ordered Overview → Health & Risk → Composition & Debt (v1.15.0 Batch 3, final)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    // Exactly one Trends landmark exists — getByRole itself throws if 0 or
    // more than 1 match, so a successful call already proves this.
    const trendsRegion = screen.getByRole('region', { name: 'Trends' });
    const trends = within(trendsRegion);

    const expectedOrder = [
      'Net Worth Trend',
      'Loan-to-Value Trend',
      'Health Factor Trend',
      'Liquidation Buffer Trend',
      'Market Price Trend',
      'Liquidation Price Trend',
      'Collateral Quantity Trend',
      'Collateral Value Trend',
      'Debt Quantity Trend',
      'Debt Value Trend',
      'Interest Cost (annualized) Trend',
      'Borrow APR Trend',
      'Supply APR Trend',
      'Leverage Trend',
    ];

    const actualHeadings = trends
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(actualHeadings).toEqual(expectedOrder);
  });

  it('leaves zero historical trend charts inside Overview, Health & Risk, or Composition & Debt after all three v1.15.0 batches (final regression sweep)', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const allTrendHeadingNames = [
      'Net Worth Trend',
      'Loan-to-Value Trend',
      'Health Factor Trend',
      'Liquidation Buffer Trend',
      'Market Price Trend',
      'Liquidation Price Trend',
      'Collateral Quantity Trend',
      'Collateral Value Trend',
      'Debt Quantity Trend',
      'Debt Value Trend',
      'Interest Cost (annualized) Trend',
      'Borrow APR Trend',
      'Supply APR Trend',
      'Leverage Trend',
    ];

    const overview = within(screen.getByRole('region', { name: 'Overview' }));
    const healthRisk = within(screen.getByRole('region', { name: 'Health & Risk' }));
    const compositionDebt = within(screen.getByRole('region', { name: 'Composition & Debt' }));

    for (const name of allTrendHeadingNames) {
      expect(overview.queryByRole('heading', { level: 3, name })).not.toBeInTheDocument();
      expect(healthRisk.queryByRole('heading', { level: 3, name })).not.toBeInTheDocument();
      expect(compositionDebt.queryByRole('heading', { level: 3, name })).not.toBeInTheDocument();
    }

    // Each group's current-state content remains, confirming these are
    // still valid, non-empty, independently labelled regions.
    expect(overview.getByText('Net Portfolio Value')).toBeInTheDocument();
    expect(healthRisk.getByText('Health Factor Status')).toBeInTheDocument();
    expect(compositionDebt.getByText('Portfolio Composition')).toBeInTheDocument();
  });

  it('places RecommendationSummarySection inside the "Recommended Actions" region', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const recommended = within(screen.getByRole('region', { name: 'Recommended Actions' }));
    expect(recommended.getByText('Recommendations')).toBeInTheDocument();
  });

  it('renders no group landmarks when calculation fails — DashboardErrorBanner’s own error branch is outside the four groups', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ collateral: { asset: 'BTC', quantity: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    expect(screen.getByText(/Unable to calculate a summary/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Overview' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Health & Risk' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Composition & Debt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Trends' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Recommended Actions' })).not.toBeInTheDocument();
  });

  it('preserves the RiskWarningBanner/NoDebtNotice zero-debt behavior inside the "Overview" region', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ debt: { asset: 'USDC', balance: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    render(<DashboardPage />);

    const overview = within(screen.getByRole('region', { name: 'Overview' }));
    expect(overview.getByText(/This portfolio has no debt position/)).toBeInTheDocument();
  });
});
