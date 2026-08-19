import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExitPlannerPage from '@/app/exit-planner/page';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

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

/**
 * Exit Planner Route — 06_TASKS.md M7-019. DoD: "Users can access the
 * Exit Planner from the Dashboard and strategy navigation." Include:
 * "Exit target controls, Current portfolio baseline, Exit result, Debt
 * repayment breakdown, Retained BTC, Cash proceeds, Warnings."
 * Milestone 7 Batch 5 replaces the placeholder Exit Result section with
 * 3 real components and adds Feasibility Analysis/Price
 * Sensitivity/Save/Saved Plans/Export — see this route's own header
 * comment.
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
  useExitPlannerStore.setState({
    exitType: null,
    targetInputs: null,
    currentResult: null,
    status: 'idle',
    errors: [],
    warnings: [],
    lastMetadata: null,
    priceSensitivity: null,
    priceSensitivityErrors: [],
    savedPlans: [],
    selectedPlanId: null,
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

function selectActivePortfolio() {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(created.data.id);
  return created.data;
}

describe('ExitPlannerPage — no active portfolio', () => {
  it('shows a prompt to select or create a portfolio instead of the strategy tools', () => {
    render(<ExitPlannerPage />);
    expect(screen.getByText(/No portfolio is currently selected/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Exit Target Controls')).not.toBeInTheDocument();
  });
});

describe('ExitPlannerPage — active portfolio (Include items)', () => {
  it('renders every named real region: Exit Target Controls, Current Portfolio Baseline, Warnings', () => {
    selectActivePortfolio();
    render(<ExitPlannerPage />);
    expect(screen.getByLabelText('Exit Target Controls')).toBeInTheDocument();
    expect(screen.getByText('Current Portfolio Baseline')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
  });

  it('prompts to configure a target before a calculation has run, not a placeholder', () => {
    selectActivePortfolio();
    render(<ExitPlannerPage />);
    expect(screen.getByText('Configure an exit target to see the result.')).toBeInTheDocument();
    expect(screen.queryByText(/M7-024/)).not.toBeInTheDocument();
  });

  it('lets a user pick a type and see a real, computed exit result end-to-end, including Full Exit Result', async () => {
    const user = userEvent.setup();
    selectActivePortfolio();
    render(<ExitPlannerPage />);

    await user.click(screen.getByRole('button', { name: 'Full Exit' }));

    expect(useExitPlannerStore.getState().currentResult).not.toBeNull();
    expect(useExitPlannerStore.getState().currentResult?.feasible).toBe(true);
    expect(screen.getByText('Full Exit Result')).toBeInTheDocument();
  });

  it('shows the "not feasible" message, not a crash, for an infeasible target', () => {
    const portfolio = selectActivePortfolio();
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 999999 });
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ExitPlannerPage />);
    expect(
      screen.getByText('This target is not feasible — see Warnings below.'),
    ).toBeInTheDocument();
  });

  it('renders a Warnings section sourced from the Exit Planner Store specifically', () => {
    const portfolio = selectActivePortfolio();
    // A repayment amount larger than the entire current debt resolves
    // to a negative target debt balance — genuinely infeasible, the
    // same real (not hand-crafted) case `exitPlannerStore.test.ts`
    // already covers in isolation.
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 999999 });
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ExitPlannerPage />);
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(useExitPlannerStore.getState().warnings.length).toBeGreaterThan(0);
  });

  it('renders all 5 new Milestone 7 Batch 5 sections: Feasibility Analysis, Price Sensitivity, Save Plan, Saved Exit Plans, Export Plan', () => {
    selectActivePortfolio();
    render(<ExitPlannerPage />);
    expect(screen.getByText('Feasibility Analysis')).toBeInTheDocument();
    expect(screen.getByText('Price Sensitivity')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Save Plan' })).toBeInTheDocument();
    expect(screen.getByText('Saved Exit Plans')).toBeInTheDocument();
    expect(screen.getByText('Export Plan')).toBeInTheDocument();
  });

  it('renders the Batch 8 (M7-044) Apply as Simulation section', () => {
    selectActivePortfolio();
    render(<ExitPlannerPage />);
    expect(screen.getByText('Apply as Simulation')).toBeInTheDocument();
  });
});

describe('ExitPlannerPage — error recovery (M7-038)', () => {
  it('shows StrategyErrorBanner with the real Engine error message when status is error', () => {
    selectActivePortfolio();
    useExitPlannerStore.setState({
      status: 'error',
      errors: [{ category: 'calculation', code: 'X', message: 'Invalid collateral quantity.' }],
    });

    render(<ExitPlannerPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid collateral quantity.');
  });

  it('keeps the last valid Full Exit Result visible underneath the error banner', () => {
    const portfolio = selectActivePortfolio();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(portfolio);
    expect(useExitPlannerStore.getState().currentResult).not.toBeNull();

    const { rerender } = render(<ExitPlannerPage />);
    expect(screen.getByText('Full Exit Result')).toBeInTheDocument();

    useExitPlannerStore.setState({
      status: 'error',
      errors: [{ category: 'calculation', code: 'X', message: 'Invalid collateral quantity.' }],
    });
    rerender(<ExitPlannerPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid collateral quantity.');
    expect(screen.getByText('Full Exit Result')).toBeInTheDocument();
  });
});

/**
 * 06_TASKS.md M9-012 ("Audit State Management") — "No cross-portfolio
 * contamination." Same fix and reasoning as `SimulationPage`'s own
 * equivalent describe block: keys the results wrapper on
 * `activePortfolioId`, plus `ExitTargetForm` calling
 * `useExitPlannerStore`'s `syncActivePortfolio` on mount/`portfolioId`
 * change, which clears the Store's working state only on a genuine
 * portfolio change.
 */
describe('ExitPlannerPage — cross-portfolio contamination (M9-012)', () => {
  it('clears a stale exit plan result computed against a previously-active portfolio when the active portfolio changes', () => {
    const portfolioA = selectActivePortfolio();
    render(<ExitPlannerPage />);

    act(() => {
      useExitPlannerStore.getState().setExitType('fullExit');
      useExitPlannerStore.getState().runExitCalculation(portfolioA);
    });
    expect(useExitPlannerStore.getState().currentResult).not.toBeNull();
    expect(screen.getByText('Full Exit Result')).toBeInTheDocument();

    act(() => {
      const createdB = usePortfolioStore.getState().create(validInput({ name: 'Portfolio B' }));
      if (!createdB.ok) throw new Error('setup failed');
      usePortfolioStore.getState().select(createdB.data.id);
    });

    expect(screen.queryByText('Full Exit Result')).not.toBeInTheDocument();
    expect(screen.getByText('Select an exit approach above to continue.')).toBeInTheDocument();
  });

  /**
   * Regression coverage for manually-verified V3/V4 portfolio isolation:
   * switching between a V4 and a V3 portfolio must clear the stale result
   * (already covered above for two V3 portfolios), and re-running the
   * calculation after each switch must use THAT portfolio's own real
   * protocol parameters — never a leftover value from the other
   * protocol's math. Switching back to the original V4 portfolio must
   * restore its exact original result, not a value crossed from V3.
   */
  it('switching V4 -> V3 -> back to V4 computes each portfolio’s own real result and restores the original V4 result on return', () => {
    const v4Portfolio = selectActivePortfolio();
    usePortfolioStore.getState().setProtocolVersion(v4Portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(v4Portfolio.id, { userAddress: V4_ADDRESS });
    usePortfolioStore.getState().setAaveV4DebtState(v4Portfolio.id, {
      drawnDebt: 30000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(v4Portfolio.id, { collateralFactor: 0.75, dynamicConfigKey: 1 });
    // The up-to-date record (with the V4 fields just set), not the stale
    // `v4Portfolio` returned by `create` before those fields existed.
    const v4 = usePortfolioStore.getState().portfolios[v4Portfolio.id].portfolio;

    render(<ExitPlannerPage />);

    act(() => {
      useExitPlannerStore.getState().setExitType('fullExit');
      useExitPlannerStore.getState().runExitCalculation(v4);
    });
    // Full exit repays the canonical V4 total (drawnDebt + premiumDebt =
    // 30500), not the legacy `debt.balance` (20000) `validInput()` sets.
    expect(useExitPlannerStore.getState().currentResult?.feasible).toBe(true);
    expect(useExitPlannerStore.getState().currentResult?.transaction?.repayment).toBeCloseTo(
      30500,
      6,
    );

    let v3: ReturnType<typeof selectActivePortfolio>;
    act(() => {
      const createdV3 = usePortfolioStore
        .getState()
        .create(validInput({ name: 'V3 Portfolio', debt: { asset: 'USDC', balance: 26000 } }));
      if (!createdV3.ok) throw new Error('setup failed');
      usePortfolioStore.getState().select(createdV3.data.id);
      v3 = createdV3.data;
    });
    // Stale V4 result is cleared by the switch, exactly like the two-V3-
    // portfolio case above.
    expect(useExitPlannerStore.getState().currentResult).toBeNull();

    act(() => {
      useExitPlannerStore.getState().setExitType('fullExit');
      useExitPlannerStore.getState().runExitCalculation(v3);
    });
    expect(useExitPlannerStore.getState().currentResult?.feasible).toBe(true);
    expect(useExitPlannerStore.getState().currentResult?.transaction?.repayment).toBeCloseTo(
      26000,
      6,
    );

    act(() => {
      usePortfolioStore.getState().select(v4.id);
    });
    expect(useExitPlannerStore.getState().currentResult).toBeNull();

    act(() => {
      useExitPlannerStore.getState().setExitType('fullExit');
      useExitPlannerStore.getState().runExitCalculation(v4);
    });
    expect(useExitPlannerStore.getState().currentResult?.feasible).toBe(true);
    expect(useExitPlannerStore.getState().currentResult?.transaction?.repayment).toBeCloseTo(
      30500,
      6,
    );
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
describe('ExitPlannerPage — V4 live-sync invocation (Stage 21)', () => {
  it('fetches live Aave V3 data on mount, independently of Dashboard/Portfolio', () => {
    selectActivePortfolio();
    render(<ExitPlannerPage />);
    expect(useAaveLiveDataStore.getState().fetchLiveAaveData).toHaveBeenCalled();
  });

  it('fetches live Aave V4 data on mount once a V4 address is set — status does not stay stuck at idle/loading on direct navigation', () => {
    const portfolio = selectActivePortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(portfolio.id, { userAddress: V4_ADDRESS });

    render(<ExitPlannerPage />);

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

    render(<ExitPlannerPage />);

    expect(screen.getByText('Aave V4 · Live')).toBeInTheDocument();
    expect(screen.queryByText('Aave V4 · Loading')).not.toBeInTheDocument();
  });

  it('never displays the raw V3 protocol.borrowApr for a V4 portfolio, and both Borrow Rate display locations agree', () => {
    const portfolio = usePortfolioStore.getState().create(
      validInput({
        protocol: {
          maxLoanToValue: 0.75,
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

    render(<ExitPlannerPage />);

    expect(screen.queryByText(/99\.00%/)).not.toBeInTheDocument();
    const borrowRateLabel = screen.getByText('Borrow Rate');
    const borrowRateValue = borrowRateLabel.nextElementSibling?.textContent;
    expect(borrowRateValue).not.toBe('Not available');
    const protocolParamsValue = screen.getByText('Protocol Parameters').nextElementSibling;
    expect(protocolParamsValue?.textContent).toContain(borrowRateValue ?? '__unmatched__');
  });
});
