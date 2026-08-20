import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoopBuilderPage from '@/app/loop-builder/page';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSimulationStore } from '@/stores/simulationStore';

const V4_ADDRESS = '0x1234567890123456789012345678901234567890';

/**
 * V4 Readiness Audit §12 Stage 21 — mirrors `tests/unit/app/page.test.tsx`'s
 * own `matchingAaveLiveState` helper exactly: stubs a `'ready'` V3 quote
 * matching `validInput()`'s own `market`/`protocol` defaults, so the
 * live-sync equality gate is a no-op for every pre-existing test below and
 * no unmocked real `fetch()` call happens during render now that this
 * route also mounts `useAaveLiveSync`/`useAaveV4LiveSync`.
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
        maxLoanToValue: 0.5,
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

/**
 * Loop Builder Route — 06_TASKS.md M7-006. DoD: "Users can open the
 * Loop Builder from the Dashboard and Simulation Workspace." Include:
 * "Strategy controls, Current portfolio baseline, Results summary, Loop
 * steps, Safety analysis, Cost analysis." Milestone 7 Batch 3 adds 5
 * more sections (Scenario Sensitivity, Apply as Simulation, Save
 * Strategy, Saved Strategies, Export Strategy) — see this route's own
 * header comment.
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
  useLoopBuilderStore.setState({
    settings: null,
    currentResult: null,
    status: 'idle',
    errors: [],
    warnings: [],
    lastMetadata: null,
    savedStrategies: [],
    selectedStrategyId: null,
    sensitivityResult: null,
    sensitivityErrors: [],
    workingPortfolioId: null,
  });
  useSimulationStore.setState({
    currentScenario: null,
    currentResult: null,
    portfolioActionPreview: null,
    savedScenarios: [],
    comparisonSelection: [],
    timelineProjection: null,
    lastMetadata: null,
    status: 'idle',
    errors: [],
    warnings: [],
    previewMode: false,
    workingPortfolioId: null,
  });
  useAaveLiveDataStore.setState(matchingAaveLiveState());
  useAaveV4LiveDataStore.setState({
    status: 'idle',
    engineInputs: null,
    userAddress: null,
    debtAsset: null,
    errorMessage: null,
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
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    ...overrides,
  };
}

function selectActivePortfolio() {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(created.data.id);
  return created.data;
}

describe('LoopBuilderPage — no active portfolio', () => {
  it('shows a prompt to select or create a portfolio instead of the strategy tools', () => {
    render(<LoopBuilderPage />);
    expect(screen.getByText(/No portfolio is currently selected/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Strategy Controls')).not.toBeInTheDocument();
  });
});

describe('LoopBuilderPage — active portfolio (Include items)', () => {
  it('renders every named region: Strategy Controls, Current Portfolio Baseline, Results Summary, Loop Steps', () => {
    selectActivePortfolio();
    render(<LoopBuilderPage />);
    expect(screen.getByLabelText('Strategy Controls')).toBeInTheDocument();
    expect(screen.getByText('Current Portfolio Baseline')).toBeInTheDocument();
    expect(screen.getByText('Results Summary')).toBeInTheDocument();
    expect(screen.getByText('Loop Steps')).toBeInTheDocument();
  });

  it('renders real Safety Analysis and Cost Analysis sections, no longer placeholders (M7-013/M7-014)', () => {
    selectActivePortfolio();
    render(<LoopBuilderPage />);
    expect(screen.getByText('Safety Analysis')).toBeInTheDocument();
    expect(screen.getByText('Cost Analysis')).toBeInTheDocument();
    expect(screen.queryByText(/Not yet implemented/i)).not.toBeInTheDocument();
  });

  it('renders all 5 new Milestone 7 Batch 3 sections: Scenario Sensitivity, Apply as Simulation, Save Strategy, Saved Strategies, Export Strategy', () => {
    selectActivePortfolio();
    render(<LoopBuilderPage />);
    expect(screen.getByText('Scenario Sensitivity')).toBeInTheDocument();
    expect(screen.getByText('Apply as Simulation')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Save Strategy' })).toBeInTheDocument();
    expect(screen.getByText('Saved Strategies')).toBeInTheDocument();
    expect(screen.getByText('Export Strategy')).toBeInTheDocument();
  });

  it('renders a Warnings section sourced from the Loop Builder Store specifically', () => {
    const portfolio = selectActivePortfolio();
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<LoopBuilderPage />);
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(useLoopBuilderStore.getState().warnings.length).toBeGreaterThan(0);
  });
});

describe('LoopBuilderPage — error recovery (M7-038)', () => {
  it('shows StrategyErrorBanner with the real Engine error message when status is error', () => {
    selectActivePortfolio();
    useLoopBuilderStore.setState({
      status: 'error',
      errors: [{ category: 'calculation', code: 'X', message: 'Invalid collateral quantity.' }],
    });

    render(<LoopBuilderPage />);
    const alerts = screen.getAllByRole('alert');
    expect(
      alerts.some((alert) => alert.textContent?.includes('Invalid collateral quantity.')),
    ).toBe(true);
  });

  it('keeps the last valid Loop Steps result visible underneath the error banner', () => {
    const portfolio = selectActivePortfolio();
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult).not.toBeNull();

    useLoopBuilderStore.setState({
      status: 'error',
      errors: [{ category: 'calculation', code: 'X', message: 'Invalid collateral quantity.' }],
    });

    render(<LoopBuilderPage />);
    const alerts = screen.getAllByRole('alert');
    expect(
      alerts.some((alert) => alert.textContent?.includes('Invalid collateral quantity.')),
    ).toBe(true);
    expect(screen.getByRole('table', { name: 'Loop strategy steps' })).toBeInTheDocument();
  });
});

/**
 * 06_TASKS.md M9-012 ("Audit State Management") — "No cross-portfolio
 * contamination." Same fix and reasoning as `SimulationPage`'s own
 * equivalent describe block: keys the results wrapper on
 * `activePortfolioId`, plus `LoopStrategyControls` calling
 * `useLoopBuilderStore`'s `syncActivePortfolio` on mount/`portfolioId`
 * change, which clears the Store's working state only on a genuine
 * portfolio change.
 */
describe('LoopBuilderPage — cross-portfolio contamination (M9-012)', () => {
  it('clears a stale loop strategy result computed against a previously-active portfolio when the active portfolio changes', () => {
    const portfolioA = selectActivePortfolio();
    render(<LoopBuilderPage />);

    act(() => {
      useLoopBuilderStore.getState().setSettings({
        targetBorrowPercentage: 0.5,
        maxLoops: 3,
        minHealthFactor: 1.1,
      });
      useLoopBuilderStore.getState().runLoopStrategy(portfolioA);
    });
    expect(useLoopBuilderStore.getState().currentResult).not.toBeNull();
    expect(
      screen.queryByText('Configure a viable strategy to see its individual steps.'),
    ).not.toBeInTheDocument();

    act(() => {
      const createdB = usePortfolioStore.getState().create(validInput({ name: 'Portfolio B' }));
      if (!createdB.ok) throw new Error('setup failed');
      usePortfolioStore.getState().select(createdB.data.id);
    });

    expect(
      screen.getByText('Configure a viable strategy to see its individual steps.'),
    ).toBeInTheDocument();
  });
});

/**
 * V4 Readiness Audit §12 Stage 21 — this route previously mounted neither
 * `useAaveLiveSync` nor `useAaveV4LiveSync`, so a user who navigated
 * straight here (never having visited Dashboard/Portfolio first) would
 * have `StrategyAssumptionsPanel`'s Manual-Data Status derived from a
 * live-data store still at its default `'idle'` state, which
 * `deriveProtocolStatus` reports as permanently "Loading" for a V4
 * portfolio. This describe block proves the fix: the route's own mount
 * now fetches independently, exactly like Dashboard/Portfolio already do.
 */
describe('LoopBuilderPage — V4 live-sync invocation (Stage 21)', () => {
  it('fetches live Aave V3 data on mount, independently of Dashboard/Portfolio', () => {
    selectActivePortfolio();
    render(<LoopBuilderPage />);
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalled();
  });

  it('fetches live Aave V4 data on mount once a V4 address is set — status does not stay stuck at idle/loading on direct navigation', () => {
    const portfolio = selectActivePortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(portfolio.id, { userAddress: V4_ADDRESS });

    render(<LoopBuilderPage />);

    expect(useAaveV4LiveDataStore.getState().fetchAaveV4LiveData).toHaveBeenCalledWith(
      V4_ADDRESS,
      'USDC',
    );
  });

  it('shows real "Aave V4 · Live" status in the Current Portfolio Baseline panel for a fully-synced V4 portfolio, not a stuck Loading state', () => {
    const portfolio = selectActivePortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(portfolio.id, { userAddress: V4_ADDRESS });
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, {
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
      .setAaveV4CollateralRisk(portfolio.id, { collateralFactor: 0.8, dynamicConfigKey: 1 });
    useAaveV4CollateralRiskLiveDataStore.setState({ status: 'ready' });

    render(<LoopBuilderPage />);

    expect(screen.getByText('Aave V4 · Live')).toBeInTheDocument();
    expect(screen.queryByText('Aave V4 · Loading')).not.toBeInTheDocument();
  });

  it('never displays the raw V3 protocol.borrowApr for a V4 portfolio, and both Borrow Rate display locations agree', () => {
    const portfolio = usePortfolioStore.getState().create(
      validInput({
        protocol: {
          maxLoanToValue: 0.5,
          liquidationThreshold: 0.8,
          borrowApr: 0.99,
          supplyApr: 0.02,
        },
      }),
    );
    if (!portfolio.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(portfolio.data.id);
    usePortfolioStore.getState().setProtocolVersion(portfolio.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(portfolio.data.id, { userAddress: V4_ADDRESS });
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.data.id, {
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    useAaveV4LiveDataStore.setState({ status: 'ready' });

    render(<LoopBuilderPage />);

    expect(screen.queryByText(/99\.00%/)).not.toBeInTheDocument();
    const borrowRateLabel = screen.getByText('Borrow Rate');
    const borrowRateValue = borrowRateLabel.nextElementSibling?.textContent;
    expect(borrowRateValue).not.toBe('Not available');
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).toContain(borrowRateValue ?? '__unmatched__');
  });
});

/**
 * BLOCKER #2 fix — clicking a Loop Builder preset on a V4 portfolio must
 * bake in the real `v4CollateralRisk.collateralFactor` as
 * `maxLoanToValueOverride`, never the legacy `protocol.maxLoanToValue`.
 * `protocol.maxLoanToValue` is deliberately `0.5` (50%, from `validInput()`)
 * while `collateralFactor` is `0.65` (65%) — a different value, so
 * leakage between the two is numerically obvious.
 */
describe('LoopBuilderPage — V4 preset seeding uses the real collateralFactor (BLOCKER #2 fix)', () => {
  it('clicking a preset on a V4 portfolio sets maxLoanToValueOverride from collateralFactor (65%), not protocol.maxLoanToValue (50%)', async () => {
    const portfolio = selectActivePortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(portfolio.id, { userAddress: V4_ADDRESS });
    usePortfolioStore.getState().setAaveV4DebtState(portfolio.id, {
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(portfolio.id, { collateralFactor: 0.65, dynamicConfigKey: 1 });

    render(<LoopBuilderPage />);

    await act(async () => {
      screen.getByRole('button', { name: /Balanced/ }).click();
    });

    const settings = useLoopBuilderStore.getState().settings;
    expect(settings?.maxLoanToValueOverride).toBeCloseTo(0.65, 10);
    expect(settings?.maxLoanToValueOverride).not.toBeCloseTo(0.5, 10);
  });
});
