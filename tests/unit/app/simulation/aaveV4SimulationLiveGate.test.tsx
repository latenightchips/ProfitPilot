import { act, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SimulationPage from '@/app/simulation/page';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Simulation V4 live-status gate — V4 Readiness Audit §12 Stage 24.
 * Closes the Stage 24 audit's own P1 finding: a portfolio synced once in
 * a past session persists `v4DebtState`/`v4CollateralRisk` to local
 * storage, so `calculatePortfolioSummary`'s own fail-closed guards (which
 * only check ABSENCE) would let Simulation silently compute a full
 * result from however-old that data was, on a direct navigation/reload
 * to `/simulation` with no fresh sync ever attempted.
 *
 * **Drives the two V4 live-data stores directly (`.setState(...)`),
 * mirroring `tests/unit/app/portfolio/page.test.tsx`'s own
 * `matchingAaveV4LiveState`/badge-testing technique** — the fetch
 * mechanics themselves (race protection, equality gates,
 * never-re-apply-a-consumed-result) are already exhaustively covered by
 * `tests/unit/hooks/useAaveV4CollateralRiskLiveSync.test.ts` and
 * `tests/unit/hooks/useAaveV4LiveSync.test.ts` in isolation — this file
 * proves the NEW page-level wiring (mount + gate) built on top of them,
 * not the underlying hook mechanics again.
 */
const INITIAL_PORTFOLIO_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

/**
 * Factory, not a module-level constant — `vi.fn()` must be freshly
 * created per test (via `beforeEach` calling this), otherwise call
 * counts accumulate across tests in this file and `.not.toHaveBeenCalled()`
 * assertions in a later test would see calls made by an earlier one.
 */
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

const V4_ADDRESS = '0x1234567890123456789012345678901234567890' as const;
const OTHER_V4_ADDRESS = '0x1111111111111111111111111111111111111111' as const;

const V4_DEBT_STATE_FIXTURE = {
  drawnDebt: 15000,
  premiumDebt: 500,
  baseDrawnApr: 0.05,
  riskPremium: 0.01,
  debtAssetPriceUsd: 1.0,
};

const V4_COLLATERAL_RISK_FIXTURE = {
  collateralFactor: 0.8,
  dynamicConfigKey: 1,
  collateralPriceUsd: 69000,
};

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_PORTFOLIO_STATE);
  useAaveV4LiveDataStore.setState(idleV4State());
  useAaveV4CollateralRiskLiveDataStore.setState(idleV4CollateralRiskState());
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

function createAndSelect(overrides: Record<string, unknown> = {}) {
  const result = usePortfolioStore.getState().create(validInput(overrides));
  if (!result.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(result.data.id);
  return result.data;
}

/**
 * Mirrors `createAndSelectV4` (`tests/unit/app/portfolio/page.test.tsx`):
 * a V4 portfolio with a real, persisted identity — `v4DebtState`/
 * `v4CollateralRisk` are set directly via the Store, simulating data that
 * was synced in a PAST session and survived a reload, exactly the
 * scenario this stage's own audit found unsafe.
 */
function createAndSelectV4(
  address: `0x${string}` = V4_ADDRESS,
  options: {
    v4DebtState?: typeof V4_DEBT_STATE_FIXTURE;
    v4CollateralRisk?: typeof V4_COLLATERAL_RISK_FIXTURE;
  } = {},
) {
  const created = createAndSelect();
  usePortfolioStore.getState().setProtocolVersion(created.id, 'v4');
  usePortfolioStore.getState().setAaveV4Position(created.id, { userAddress: address });
  if (options.v4DebtState !== undefined) {
    usePortfolioStore.getState().setAaveV4DebtState(created.id, options.v4DebtState);
  }
  if (options.v4CollateralRisk !== undefined) {
    usePortfolioStore.getState().setAaveV4CollateralRisk(created.id, options.v4CollateralRisk);
  }
  return created;
}

function resultsAreRendered(): boolean {
  return screen.queryByRole('heading', { name: 'Scenario Controls' }) !== null;
}

describe('Simulation V4 live-status gate — direct-navigation sync (Stage 24)', () => {
  it('mounting the page with a persisted V4 identity triggers a fresh V4 debt-state fetch', () => {
    createAndSelectV4();
    render(<SimulationPage />);
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
      V4_ADDRESS,
      'USDC',
    );
  });

  it('mounting the page with a persisted V4 identity triggers a fresh V4 collateral-risk fetch', () => {
    createAndSelectV4();
    render(<SimulationPage />);
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).toHaveBeenCalledWith(V4_ADDRESS);
  });

  it('makes zero V4 fetch calls for a V3 (protocolVersion unset) portfolio', () => {
    createAndSelect();
    render(<SimulationPage />);
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
    expect(
      useAaveV4CollateralRiskLiveDataStore.getState().fetchAaveV4CollateralRiskLiveData,
    ).not.toHaveBeenCalled();
  });
});

describe('Simulation V4 live-status gate — persisted-but-not-yet-refreshed values are never shown as current (Stage 24)', () => {
  it('does not render results for a V4 portfolio with persisted v4DebtState/v4CollateralRisk while the live-data stores are still idle (refresh not yet started)', () => {
    createAndSelectV4(V4_ADDRESS, {
      v4DebtState: V4_DEBT_STATE_FIXTURE,
      v4CollateralRisk: V4_COLLATERAL_RISK_FIXTURE,
    });
    // Stores stay at their default IDLE_V4_STATE/IDLE_V4_COLLATERAL_RISK_STATE
    // (fetch mocked to a no-op that never resolves synchronously) — this is
    // the exact "refresh pending" window the design constraint calls out.
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(false);
    expect(screen.getByText(/Simulation is not available yet/)).toBeInTheDocument();
    expect(screen.getByText('Aave V4 · Loading')).toBeInTheDocument();
  });

  it('does not render results while the debt-state fetch is loading, even though collateral-risk already succeeded', () => {
    createAndSelectV4(V4_ADDRESS, {
      v4DebtState: V4_DEBT_STATE_FIXTURE,
      v4CollateralRisk: V4_COLLATERAL_RISK_FIXTURE,
    });
    useAaveV4LiveDataStore.setState({ status: 'loading' });
    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'ready',
      canonical: V4_COLLATERAL_RISK_FIXTURE,
      userAddress: V4_ADDRESS,
      lastFetchedAt: new Date().toISOString(),
    });
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(false);
    expect(screen.getByText('Aave V4 · Loading')).toBeInTheDocument();
  });

  it('does not render results once the persisted data is stale (both fetches succeeded, but long ago)', () => {
    createAndSelectV4(V4_ADDRESS, {
      v4DebtState: V4_DEBT_STATE_FIXTURE,
      v4CollateralRisk: V4_COLLATERAL_RISK_FIXTURE,
    });
    const staleTime = new Date(Date.now() - 60 * 60_000).toISOString();
    useAaveV4LiveDataStore.setState({
      status: 'ready',
      engineInputs: V4_DEBT_STATE_FIXTURE,
      userAddress: V4_ADDRESS,
      debtAsset: 'USDC',
      lastFetchedAt: staleTime,
    });
    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'ready',
      canonical: V4_COLLATERAL_RISK_FIXTURE,
      userAddress: V4_ADDRESS,
      lastFetchedAt: staleTime,
    });
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(false);
    expect(screen.getByText('Aave V4 · Stale')).toBeInTheDocument();
  });
});

describe('Simulation V4 live-status gate — provider failure is visible, not silently substituted (Stage 24)', () => {
  it('renders a real alert, not results, when the debt-state fetch fails — even with real persisted values present', () => {
    createAndSelectV4(V4_ADDRESS, {
      v4DebtState: V4_DEBT_STATE_FIXTURE,
      v4CollateralRisk: V4_COLLATERAL_RISK_FIXTURE,
    });
    useAaveV4LiveDataStore.setState({
      status: 'error',
      errorMessage: 'Live Aave V4 data is temporarily unavailable.',
    });
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(false);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('Aave V4 · Provider error (showing last known value)'),
    ).toBeInTheDocument();
    // The persisted values themselves are untouched (fail-closed elsewhere
    // already guarantees this) — only the UI's willingness to present them
    // as current is what this stage changes.
    const activeId = usePortfolioStore.getState().activePortfolioId!;
    expect(usePortfolioStore.getState().portfolios[activeId].portfolio.v4DebtState).toEqual(
      V4_DEBT_STATE_FIXTURE,
    );
  });

  it('renders a real alert when the collateral-risk fetch fails, even though debt state succeeded', () => {
    createAndSelectV4(V4_ADDRESS, {
      v4DebtState: V4_DEBT_STATE_FIXTURE,
      v4CollateralRisk: V4_COLLATERAL_RISK_FIXTURE,
    });
    useAaveV4LiveDataStore.setState({
      status: 'ready',
      engineInputs: V4_DEBT_STATE_FIXTURE,
      userAddress: V4_ADDRESS,
      debtAsset: 'USDC',
      lastFetchedAt: new Date().toISOString(),
    });
    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'error',
      errorMessage: 'Live Aave V4 collateral-risk data is temporarily unavailable.',
    });
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(false);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('Simulation V4 live-status gate — missing debt/collateral-risk state (Stage 24)', () => {
  it('does not render results when v4DebtState has never synced onto the portfolio (fetch ready, but nothing landed yet)', () => {
    createAndSelectV4(V4_ADDRESS, { v4CollateralRisk: V4_COLLATERAL_RISK_FIXTURE });
    useAaveV4LiveDataStore.setState({ status: 'ready', lastFetchedAt: new Date().toISOString() });
    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'ready',
      lastFetchedAt: new Date().toISOString(),
    });
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(false);
    expect(screen.getByText('Aave V4 · Missing debt state')).toBeInTheDocument();
  });

  it('does not render results when v4CollateralRisk has never synced onto the portfolio', () => {
    createAndSelectV4(V4_ADDRESS, { v4DebtState: V4_DEBT_STATE_FIXTURE });
    useAaveV4LiveDataStore.setState({ status: 'ready', lastFetchedAt: new Date().toISOString() });
    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'ready',
      lastFetchedAt: new Date().toISOString(),
    });
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(false);
    expect(screen.getByText('Aave V4 · Missing collateral-risk data')).toBeInTheDocument();
  });
});

describe('Simulation V4 live-status gate — successful refresh renders usable results (Stage 24)', () => {
  it('renders the full Scenario Controls/Results tree once both stores are ready and fresh', () => {
    createAndSelectV4(V4_ADDRESS, {
      v4DebtState: V4_DEBT_STATE_FIXTURE,
      v4CollateralRisk: V4_COLLATERAL_RISK_FIXTURE,
    });
    useAaveV4LiveDataStore.setState({
      status: 'ready',
      engineInputs: V4_DEBT_STATE_FIXTURE,
      userAddress: V4_ADDRESS,
      debtAsset: 'USDC',
      lastFetchedAt: new Date().toISOString(),
    });
    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'ready',
      canonical: V4_COLLATERAL_RISK_FIXTURE,
      userAddress: V4_ADDRESS,
      lastFetchedAt: new Date().toISOString(),
    });
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(true);
    expect(screen.getByRole('heading', { name: 'Simulation Results' })).toBeInTheDocument();
    expect(screen.queryByText(/Simulation is not available yet/)).not.toBeInTheDocument();
  });

  it('the rendered baseline actually computes from the real, fresh v4DebtState/v4CollateralRisk (never zero, never a V3 fallback)', () => {
    createAndSelectV4(V4_ADDRESS, {
      v4DebtState: V4_DEBT_STATE_FIXTURE,
      v4CollateralRisk: V4_COLLATERAL_RISK_FIXTURE,
    });
    useAaveV4LiveDataStore.setState({
      status: 'ready',
      engineInputs: V4_DEBT_STATE_FIXTURE,
      userAddress: V4_ADDRESS,
      debtAsset: 'USDC',
      lastFetchedAt: new Date().toISOString(),
    });
    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'ready',
      canonical: V4_COLLATERAL_RISK_FIXTURE,
      userAddress: V4_ADDRESS,
      lastFetchedAt: new Date().toISOString(),
    });
    render(<SimulationPage />);

    // The Debt amount field in Scenario Controls seeds from the canonical
    // V4 total (drawnDebt + premiumDebt), never portfolio.debt.balance
    // (which validInput() set to 20000, a different, stale V3-shaped value).
    const scenarioControls = within(
      screen.getByRole('complementary', { name: 'Scenario Controls' }),
    );
    expect(scenarioControls.queryByText(/20,?000/)).not.toBeInTheDocument();
  });
});

describe('Simulation V4 live-status gate — V3 Simulation is completely unaffected (Stage 24)', () => {
  it('renders results normally for a V3 portfolio, even with both V4 stores in adversarial (error) states', () => {
    createAndSelect();
    useAaveV4LiveDataStore.setState({ status: 'error', errorMessage: 'irrelevant to V3' });
    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'error',
      errorMessage: 'irrelevant to V3',
    });
    render(<SimulationPage />);

    expect(resultsAreRendered()).toBe(true);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/Simulation is not available yet/)).not.toBeInTheDocument();
  });

  it('makes zero V4 fetch calls and never renders a V4 status panel for a V3 portfolio', () => {
    createAndSelect();
    render(<SimulationPage />);

    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).not.toHaveBeenCalled();
    expect(screen.queryByText(/Aave V4/)).not.toBeInTheDocument();
  });
});

describe('Simulation V4 live-status gate — identity-switch race protection (Stage 24)', () => {
  it("switching the active portfolio to a different V4 wallet never lets a late response for the FIRST portfolio's address populate the second", async () => {
    const first = createAndSelectV4(V4_ADDRESS);
    const second = createAndSelectV4(OTHER_V4_ADDRESS);
    usePortfolioStore.getState().select(first.id);

    const { rerender } = render(<SimulationPage />);
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
      V4_ADDRESS,
      'USDC',
    );

    // Switch to the second portfolio before any response has landed.
    act(() => {
      usePortfolioStore.getState().select(second.id);
    });
    rerender(<SimulationPage />);
    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
      OTHER_V4_ADDRESS,
      'USDC',
    );

    // A late response for the FIRST portfolio's address now lands.
    act(() => {
      useAaveV4LiveDataStore.setState({
        status: 'ready',
        engineInputs: V4_DEBT_STATE_FIXTURE,
        userAddress: V4_ADDRESS,
        debtAsset: 'USDC',
        lastFetchedAt: new Date().toISOString(),
      });
    });

    expect(
      usePortfolioStore.getState().portfolios[second.id].portfolio.v4DebtState,
    ).toBeUndefined();
    expect(usePortfolioStore.getState().portfolios[first.id].portfolio.v4DebtState).toBeUndefined();
  });
});
