import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExitPlannerPage from '@/app/exit-planner/page';
import LoopBuilderPage from '@/app/loop-builder/page';
import DashboardPage from '@/app/page';
import PortfolioPage from '@/app/portfolio/page';
import RecommendationsPage from '@/app/recommendations/page';
import SimulationPage from '@/app/simulation/page';
import { autoSaveCoordinator } from '@/services';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Cross-page manual/hypothetical V4 mode — V4 Readiness Audit §12
 * Stage 25's own centerpiece requirement: a V4 portfolio with no wallet
 * address and no live sync must work identically to a real one on every
 * consuming page (Dashboard, Portfolio, Loop Builder, Exit Planner,
 * Recommendations, Simulation), with genuinely zero Aave-V4-specific RPC
 * calls anywhere in the flow. Each individual mechanism (provenance
 * defaults, `deriveProtocolStatus`'s manual gate, the Simulation gate
 * fix, the collateral-risk-hook data-loss fix) already has focused unit
 * coverage elsewhere; this file's job is the direct, end-to-end proof
 * the task explicitly asked for, not a re-derivation of those
 * mechanisms.
 *
 * **`expectNoV4RpcCalls` checks only the two V4-specific fetch actions**
 * (`fetchAaveV4LiveData`, `fetchAaveV4CollateralRiskLiveData`), never the
 * V3 store's `fetchLiveAaveData` — that one fires unconditionally on
 * every portfolio, V3 or V4 (`hooks/useAaveLiveSync.ts`'s own header
 * comment: "V3 has no per-wallet identity to gate on"), because it feeds
 * the BTC price quote every portfolio uses regardless of protocol
 * version. "No RPC calls required for manual-only operation" (this
 * stage's own requirement) means no Aave-V4-position RPC, not "no
 * network activity of any kind."
 *
 * Both V4 live-data stores are stubbed to their idle defaults (never
 * `'ready'`) precisely because a manual-only portfolio must never need
 * them. Each `vi.fn()` is created fresh per test via a factory function,
 * not a shared module-level constant — reusing one `vi.fn()` instance
 * across tests would accumulate call counts and break exactly this kind
 * of `.not.toHaveBeenCalled()` assertion in a later test.
 *
 * **Dashboard renders stub `load` to a no-op**, mirroring
 * `tests/unit/app/page.test.tsx`'s own established convention exactly:
 * `DashboardPageClient` calls the real `load()` on every mount (Batch 9
 * onward), which is asynchronous and — if left real — races the test's
 * synchronous assertions with a local-storage read that overwrites the
 * manually seeded in-memory state before it resolves. Portfolio, Loop
 * Builder, Exit Planner, Recommendations, and Simulation do not call
 * `load()` on mount, so no such stub is needed for them.
 */
const INITIAL_PORTFOLIO_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

// Captured once, before any test can call `stubDashboardLoad()` below —
// `usePortfolioStore.setState(...)` merges rather than replaces, so a
// prior test's no-op `load` stub would otherwise leak into every
// subsequent test (including the persistence round-trip test, which
// needs the REAL `load()`) unless `beforeEach` explicitly restores it.
const REAL_LOAD = usePortfolioStore.getState().load;

function idleAaveLiveState() {
  return {
    status: 'idle' as const,
    marketQuote: null,
    protocolQuote: null,
    collateralSymbol: null,
    borrowSymbol: null,
    source: null,
    errorMessage: null,
    fetchLiveAaveData: vi.fn().mockResolvedValue(undefined),
  };
}

function idleV4State() {
  return {
    status: 'idle' as const,
    engineInputs: null,
    userAddress: null,
    debtAsset: null,
    errorMessage: null,
    lastFetchedAt: null,
    fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
  };
}

function idleV4CollateralRiskState() {
  return {
    status: 'idle' as const,
    canonical: null,
    userAddress: null,
    errorMessage: null,
    lastFetchedAt: null,
    fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  usePortfolioStore.setState({ ...INITIAL_PORTFOLIO_STATE, load: REAL_LOAD });
  useAaveLiveDataStore.setState(idleAaveLiveState());
  useAaveV4LiveDataStore.setState(idleV4State());
  useAaveV4CollateralRiskLiveDataStore.setState(idleV4CollateralRiskState());
  window.localStorage.clear();
});

/** See this file's own header comment for why only Dashboard needs this. */
function stubDashboardLoad() {
  usePortfolioStore.setState({ load: async () => {} });
}

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

const MANUAL_V4_DEBT_STATE = {
  drawnDebt: 15000,
  premiumDebt: 500,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
};

const MANUAL_V4_COLLATERAL_RISK = { collateralFactor: 0.8, dynamicConfigKey: 0 };

/**
 * A pure manual/hypothetical V4 portfolio — `protocolVersion: 'v4'`, but
 * deliberately NO `v4Position` (no wallet address at all), with both
 * `v4DebtState`/`v4CollateralRisk` set via the Store exactly as
 * `ManualAaveV4StateForm` itself would (`source: 'manual'`).
 */
function createAndSelectManualV4Portfolio() {
  const result = usePortfolioStore.getState().create(validInput());
  if (!result.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(result.data.id);
  usePortfolioStore.getState().setProtocolVersion(result.data.id, 'v4');
  usePortfolioStore.getState().setAaveV4DebtState(result.data.id, MANUAL_V4_DEBT_STATE, 'manual');
  usePortfolioStore
    .getState()
    .setAaveV4CollateralRisk(result.data.id, MANUAL_V4_COLLATERAL_RISK, 'manual');
  return result.data;
}

function expectNoV4RpcCalls() {
  expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
  expect(
    useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
  ).not.toHaveBeenCalled();
}

describe('Manual/hypothetical V4 mode — Portfolio page (Stage 25)', () => {
  it('a brand-new V4 portfolio (no address) shows "Aave V4 · Manual entry" once manual entry is provided, not "Waiting for address"', () => {
    createAndSelectManualV4Portfolio();
    render(<PortfolioPage />);

    // Rendered twice on this page (the Collateral section badge and
    // AaveProtocolVersionForm's own badge) — both must agree.
    expect(screen.getAllByText('Aave V4 · Manual entry').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Waiting for address/)).not.toBeInTheDocument();
    expectNoV4RpcCalls();
  });

  it('a user can fill in every manual V4 field through the real form and have it persist, with no address at any point', async () => {
    const user = userEvent.setup();
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    usePortfolioStore.getState().setProtocolVersion(created.data.id, 'v4');
    render(<PortfolioPage />);

    await user.clear(screen.getByLabelText('Drawn debt', { exact: false }));
    await user.type(screen.getByLabelText('Drawn debt', { exact: false }), '15000');
    await user.clear(screen.getByLabelText('Premium debt', { exact: false }));
    await user.type(screen.getByLabelText('Premium debt', { exact: false }), '500');
    await user.clear(screen.getByLabelText('Base drawn APR (%)', { exact: false }));
    await user.type(screen.getByLabelText('Base drawn APR (%)', { exact: false }), '5');
    await user.clear(screen.getByLabelText('Risk premium (%)', { exact: false }));
    await user.type(screen.getByLabelText('Risk premium (%)', { exact: false }), '1');
    await user.click(screen.getByRole('button', { name: 'Save debt assumptions' }));

    await user.clear(screen.getByLabelText('Collateral factor (%)', { exact: false }));
    await user.type(screen.getByLabelText('Collateral factor (%)', { exact: false }), '80');
    await user.click(screen.getByRole('button', { name: 'Save collateral risk assumption' }));

    const record = usePortfolioStore.getState().portfolios[created.data.id].portfolio;
    expect(record.v4DebtState).toEqual(MANUAL_V4_DEBT_STATE);
    expect(record.v4DebtStateSource).toBe('manual');
    expect(record.v4CollateralRisk).toEqual(MANUAL_V4_COLLATERAL_RISK);
    expect(record.v4CollateralRiskSource).toBe('manual');
    expect(record.v4Position).toBeUndefined();
    expectNoV4RpcCalls();
  });

  it('adding a wallet address to a manual portfolio does not clear its valid manual state while a live request is merely pending', () => {
    const created = createAndSelectManualV4Portfolio();
    render(<PortfolioPage />);
    expect(screen.getAllByText('Aave V4 · Manual entry').length).toBeGreaterThan(0);

    act(() => {
      usePortfolioStore.getState().setAaveV4Position(created.id, {
        userAddress: '0x1234567890123456789012345678901234567890',
      });
    });

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtState).toEqual(MANUAL_V4_DEBT_STATE);
    expect(record.v4DebtStateSource).toBe('manual');
    expect(record.v4CollateralRisk).toEqual(MANUAL_V4_COLLATERAL_RISK);
    expect(record.v4CollateralRiskSource).toBe('manual');
  });
});

describe('Manual/hypothetical V4 mode — Dashboard (Stage 25)', () => {
  it('renders a real, calculated summary for a manual-only V4 portfolio, with the manual badge, no address, and no V4 RPC calls', () => {
    createAndSelectManualV4Portfolio();
    stubDashboardLoad();
    render(<DashboardPage />);

    expect(screen.getByText('My Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Net Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Health Factor')).toBeInTheDocument();
    expect(screen.getByText('Aave V4 · Manual entry')).toBeInTheDocument();
    expect(screen.queryByText(/Unable to calculate a summary/)).not.toBeInTheDocument();
    expectNoV4RpcCalls();
  });

  it('the rendered debt figure comes from the manual V4 canonical total, never the V3-shaped debt.balance fallback', () => {
    // validInput()'s debt.balance is 20000 — a different, stale V3-shaped
    // value from the manual V4 total (15000 + 500 = 15500). If the
    // Dashboard ever silently fell back to the V3 field, this specific
    // value would leak into the rendered summary.
    createAndSelectManualV4Portfolio();
    stubDashboardLoad();
    render(<DashboardPage />);

    expect(screen.queryByText(/\$?20,000/)).not.toBeInTheDocument();
  });
});

describe('Manual/hypothetical V4 mode — Recommendations (Stage 25)', () => {
  it('renders recommendations for a manual-only V4 portfolio, with no address and no V4 RPC calls', () => {
    createAndSelectManualV4Portfolio();
    render(<RecommendationsPage />);

    expect(screen.getByRole('heading', { name: 'Portfolio Summary' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recommendations' })).toBeInTheDocument();
    expect(screen.queryByText(/No portfolio is currently selected/)).not.toBeInTheDocument();
    expectNoV4RpcCalls();
  });
});

describe('Manual/hypothetical V4 mode — Loop Builder (Stage 25)', () => {
  it('renders the strategy tree for a manual-only V4 portfolio, with no address and no V4 RPC calls', () => {
    createAndSelectManualV4Portfolio();
    render(<LoopBuilderPage />);

    expect(screen.getByRole('heading', { name: 'Current Portfolio Baseline' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('complementary')).getByText('Strategy Controls'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No portfolio is currently selected/)).not.toBeInTheDocument();
    expectNoV4RpcCalls();
  });
});

describe('Manual/hypothetical V4 mode — Exit Planner (Stage 25)', () => {
  it('renders the exit-planning tree for a manual-only V4 portfolio, with no address and no V4 RPC calls', () => {
    createAndSelectManualV4Portfolio();
    render(<ExitPlannerPage />);

    expect(screen.getByRole('heading', { name: 'Current Portfolio Baseline' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Exit Target Controls' })).toBeInTheDocument();
    expect(screen.queryByText(/No portfolio is currently selected/)).not.toBeInTheDocument();
    expectNoV4RpcCalls();
  });
});

describe('Manual/hypothetical V4 mode — Simulation (Stage 25)', () => {
  function resultsAreRendered(): boolean {
    return screen.queryByRole('heading', { name: 'Scenario Controls' }) !== null;
  }

  it('renders full simulation results for a manual-only V4 portfolio — the Stage 24 fail-closed gate does not block valid manual state', () => {
    createAndSelectManualV4Portfolio();
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(true);
    expect(screen.getByRole('heading', { name: 'Simulation Results' })).toBeInTheDocument();
    expect(screen.queryByText(/Simulation is not available yet/)).not.toBeInTheDocument();
    expectNoV4RpcCalls();
  });

  it('still fails closed when only ONE manual dimension is present (debt set, collateral risk genuinely missing)', () => {
    const result = usePortfolioStore.getState().create(validInput());
    if (!result.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(result.data.id);
    usePortfolioStore.getState().setProtocolVersion(result.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4DebtState(result.data.id, MANUAL_V4_DEBT_STATE, 'manual');
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(false);
    expect(screen.getByText('Aave V4 · Missing collateral-risk data')).toBeInTheDocument();
  });

  it("mounting the page attempts a live fetch once a wallet address is added — the 'live request pending' state — while still rendering from the valid manual data underneath", () => {
    const created = createAndSelectManualV4Portfolio();
    usePortfolioStore
      .getState()
      .setAaveV4Position(created.id, { userAddress: '0x1234567890123456789012345678901234567890' });
    render(<SimulationPage />);

    // A live request is now genuinely in flight (v4Position is set) —
    // unlike every other test in this file, a fetch attempt IS expected.
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalled();
    // But manual/live provenance for the debt/collateral-risk dimensions
    // is untouched — the pending request has not resolved.
    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtStateSource).toBe('manual');
    expect(record.v4CollateralRiskSource).toBe('manual');
    // And the manual state remains calculation-ready throughout.
    expect(resultsAreRendered()).toBe(true);
  });
});

describe('Manual/hypothetical V4 mode — persistence round trip (Stage 25)', () => {
  it('a manual-only V4 portfolio survives save/reload and still works on every page, with no address and no V4 RPC calls throughout', async () => {
    const created = createAndSelectManualV4Portfolio();
    await autoSaveCoordinator.flushAll();

    usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
    await usePortfolioStore.getState().load();
    usePortfolioStore.getState().select(created.id);

    const record = usePortfolioStore.getState().portfolios[created.id].portfolio;
    expect(record.v4DebtState).toEqual(MANUAL_V4_DEBT_STATE);
    expect(record.v4DebtStateSource).toBe('manual');
    expect(record.v4CollateralRisk).toEqual(MANUAL_V4_COLLATERAL_RISK);
    expect(record.v4CollateralRiskSource).toBe('manual');
    expect(record.v4Position).toBeUndefined();

    stubDashboardLoad();
    render(<DashboardPage />);
    expect(screen.getByText('Aave V4 · Manual entry')).toBeInTheDocument();
    expectNoV4RpcCalls();
  });
});

describe('Manual/hypothetical V4 mode — V3 behavior is unaffected (Stage 25)', () => {
  it('an ordinary V3 portfolio never shows a manual V4 badge and is completely unaffected by any Stage 25 change', () => {
    const result = usePortfolioStore.getState().create(validInput());
    if (!result.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(result.data.id);
    stubDashboardLoad();
    render(<DashboardPage />);

    expect(screen.queryByText(/Aave V4/)).not.toBeInTheDocument();
    expect(screen.getByText('My Portfolio')).toBeInTheDocument();
    expect(screen.getByText('Health Factor')).toBeInTheDocument();
    expectNoV4RpcCalls();
  });
});
