import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SimulationAssumptions } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';
import type { ProtocolStatusKind } from '@/utils/protocolStatus';

/**
 * Simulation Assumptions Panel — 06_TASKS.md M6-013 ("Implement
 * Simulation Assumptions Panel"). DoD: "Every simulation is fully
 * transparent." Every assertion below checks a value the real Service
 * actually computed (via the real Store actions), never a hand-crafted
 * mock result.
 */
const PORTFOLIO: ApplicationPortfolio = {
  collateral: { asset: 'BTC', quantity: 2 },
  debt: { asset: 'USDC', balance: 20000 },
  market: { btcPriceUsd: 50000 },
  protocol: {
    maxLoanToValue: 0.75,
    liquidationThreshold: 0.8,
    borrowApr: 0.05,
    supplyApr: 0.02,
  },
};

beforeEach(() => {
  useSimulationStore.getState().reset();
});

describe('SimulationAssumptions — empty state', () => {
  it('prompts the user to run a simulation, rather than rendering empty assumptions', () => {
    render(<SimulationAssumptions portfolio={PORTFOLIO} />);
    expect(screen.getByText('Run a simulation to see its assumptions.')).toBeInTheDocument();
  });
});

describe('SimulationAssumptions — price scenario', () => {
  it('shows the real price assumption, protocol parameters, and formula version, with no Rate Assumptions row', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText('Price Assumptions')).toBeInTheDocument();
    expect(screen.getByText('$60,000.00')).toBeInTheDocument();
    expect(screen.queryByText('Rate Assumptions')).not.toBeInTheDocument();

    expect(screen.getByText('Protocol Parameters')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Max LTV 75.00% · Liquidation Threshold 80.00% · Borrow APR 5.00% · Supply APR 2.00%',
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('Fees & Slippage')).toBeInTheDocument();
    expect(screen.getByText(/Not applicable/)).toBeInTheDocument();
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('Formula ID');
    expect(bodyText).not.toContain('02_Formulas.md');

    expect(screen.getByText('Formula Version')).toBeInTheDocument();
    expect(screen.getByText(/Engine .+ · Formula/)).toBeInTheDocument();
  });
});

describe('SimulationAssumptions — interest scenario', () => {
  it('shows both Price and Rate Assumptions, distinct from Protocol Parameters', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: 0.2 },
      borrowApr: 0.1,
      timeHorizonDays: 100,
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText('+20.00%')).toBeInTheDocument();
    expect(screen.getByText('Rate Assumptions')).toBeInTheDocument();
    expect(screen.getByText('10.00% over 100 days')).toBeInTheDocument();
    // Protocol Parameters still shows the portfolio's own configured 5% —
    // distinct from the 10% simulated Rate Assumption above.
    expect(screen.getByText(/Borrow APR 5\.00%/)).toBeInTheDocument();
  });

  it('renders a negative percentage change without a leading "+" sign', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: -0.1 },
      borrowApr: 0.1,
      timeHorizonDays: 30,
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText('-10.00%')).toBeInTheDocument();
  });
});

describe('SimulationAssumptions — Formula Version survives Load (Batch 18, M6-019 fix)', () => {
  it('still shows Formula Version after loading a saved scenario, not just a freshly-run one', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    if (id === null) throw new Error('setup failed');

    useSimulationStore.getState().setCurrentScenario(null);
    useSimulationStore.getState().loadSavedScenario(id);

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);
    expect(screen.getByText('Formula Version')).toBeInTheDocument();
    expect(screen.getByText(/Engine .+ · Formula/)).toBeInTheDocument();
  });
});

/**
 * V4 Protocol Parameters Borrow APR — V4 Readiness Audit §12 Stage 20.
 * `protocol.borrowApr` and `v4DebtState.baseDrawnApr`/`riskPremium` are
 * deliberately different values so a legacy-field read is directly
 * observable.
 */
describe('SimulationAssumptions — V4 Protocol Parameters Borrow APR (Stage 20)', () => {
  const V4_PORTFOLIO: ApplicationPortfolio = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 999999 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.99, // deliberately unrelated — must never be displayed for V4
      supplyApr: 0.02,
    },
    protocolVersion: 'v4',
    v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
    v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
    v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
  };

  it('shows the canonical blended effective V4 rate, never the raw legacy protocol.borrowApr', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(V4_PORTFOLIO, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={V4_PORTFOLIO} />);

    // Same Stage 10/15/16 regression vector: annualCost 1100 / totalDebt 20500 ≈ 5.37%.
    expect(screen.getByText(/Borrow APR 5\.37%/)).toBeInTheDocument();
    expect(screen.queryByText(/Borrow APR 99\.00%/)).not.toBeInTheDocument();
  });

  it('shows "Not available" rather than a fabricated or stale V3 number when v4DebtState has not synced yet', () => {
    const noStatePortfolio: ApplicationPortfolio = { ...V4_PORTFOLIO, v4DebtState: undefined };
    // A real result must already exist for this component to render its
    // content instead of the empty-state prompt — this test exercises
    // the Borrow APR display helper specifically, using a *different*
    // portfolio object as the `portfolio` prop than the one the Store's
    // own result was computed against (the display reads directly from
    // the prop, not from the stored result).
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(V4_PORTFOLIO, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={noStatePortfolio} />);

    expect(screen.getByText(/Borrow APR Not available/)).toBeInTheDocument();
  });
});

/**
 * "Max LTV"/"Liquidation Threshold" vs. "Collateral Factor" — V4
 * Readiness Audit §12 Stage 23E. V4 has no separate max-LTV/liquidation-
 * threshold pair (Stage 23B). `collateralFactor: 0.65` deliberately
 * differs from `V4_PORTFOLIO`'s own `protocol.liquidationThreshold: 0.8`,
 * so a test that silently used the V3 field would fail on an exact
 * numeric mismatch.
 */
describe('SimulationAssumptions — V4 risk-capacity display (Stage 23E)', () => {
  const V4_PORTFOLIO: ApplicationPortfolio = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 999999 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.99,
      supplyApr: 0.02,
    },
    protocolVersion: 'v4',
    v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
    v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
    v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
  };

  it('shows Collateral Factor (never Max LTV/Liquidation Threshold) for a V4 portfolio with synced v4CollateralRisk', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(V4_PORTFOLIO, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={V4_PORTFOLIO} />);

    expect(screen.getByText(/Collateral Factor 65\.00%/)).toBeInTheDocument();
    expect(screen.queryByText(/Max LTV/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Liquidation Threshold/)).not.toBeInTheDocument();
  });

  it('shows "Collateral Factor Not available" when v4CollateralRisk has not synced yet, never falling back to a V3 number', () => {
    const noRiskPortfolio: ApplicationPortfolio = { ...V4_PORTFOLIO, v4CollateralRisk: undefined };
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(V4_PORTFOLIO, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={noRiskPortfolio} />);

    expect(screen.getByText(/Collateral Factor Not available/)).toBeInTheDocument();
  });

  it('a V3 (or unset) portfolio is completely unaffected — still shows Max LTV/Liquidation Threshold', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(PORTFOLIO, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText(/Max LTV 75\.00%/)).toBeInTheDocument();
    expect(screen.getByText(/Liquidation Threshold 80\.00%/)).toBeInTheDocument();
    expect(screen.queryByText(/Collateral Factor/)).not.toBeInTheDocument();
  });
});

/**
 * "Supply APR" — V4 Readiness Audit §12 P1-1, corrected by the Supply
 * APR Semantic-Boundary Fix. No V4 boundary this codebase talks to
 * exposes an authoritative supply rate, and no V4-facing form ever lets a
 * user assert one manually either — so a V4 portfolio must never show
 * `protocol.supplyApr` at all, regardless of `v4CollateralRiskSource`
 * (P1-1's own now-corrected premise). The whole "Supply APR" segment is
 * omitted from the Protocol Parameters line for V4, not shown as "Not
 * available" — that wording is reserved for a value that could genuinely
 * become available later, which V4 Supply APR never is. Mirrors the
 * Borrow APR/risk-capacity describe blocks above's own "deliberately
 * non-matching value" fixture discipline.
 */
describe('SimulationAssumptions — Supply APR (P1-1, corrected by the Supply APR Semantic-Boundary Fix)', () => {
  const LIVE_V4_PORTFOLIO: ApplicationPortfolio = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 999999 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.045, // deliberately non-zero, plausible — must never be displayed
    },
    protocolVersion: 'v4',
    v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
    v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
    v4CollateralRisk: { collateralFactor: 0.7, dynamicConfigKey: 1 },
    v4CollateralRiskSource: 'live',
  };

  it('V3: shows the real protocol.supplyApr, unchanged', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(PORTFOLIO, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText(/Supply APR 2\.00%/)).toBeInTheDocument();
  });

  it('live V4: omits "Supply APR" entirely, never the leftover protocol.supplyApr figure', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(LIVE_V4_PORTFOLIO, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={LIVE_V4_PORTFOLIO} />);

    expect(screen.queryByText(/Supply APR/)).not.toBeInTheDocument();
    expect(screen.queryByText(/4\.50%/)).not.toBeInTheDocument();
  });

  it('V4 with no v4CollateralRisk synced yet: omits "Supply APR" entirely, not the inherited figure', () => {
    const noRiskPortfolio: ApplicationPortfolio = {
      ...LIVE_V4_PORTFOLIO,
      v4CollateralRisk: undefined,
      v4CollateralRiskSource: undefined,
    };
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(LIVE_V4_PORTFOLIO, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={noRiskPortfolio} />);

    expect(screen.queryByText(/Supply APR/)).not.toBeInTheDocument();
  });

  it('manual V4: STILL omits "Supply APR" entirely — manually asserting collateralFactor is not the same as asserting protocol.supplyApr (the exact P1-1 bug this fix closes)', () => {
    const manualV4Portfolio: ApplicationPortfolio = {
      ...LIVE_V4_PORTFOLIO,
      protocol: { ...LIVE_V4_PORTFOLIO.protocol, supplyApr: 0.02 },
      v4CollateralRiskSource: 'manual',
    };
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(manualV4Portfolio, { collateralDelta: 0, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={manualV4Portfolio} />);

    expect(screen.queryByText(/Supply APR/)).not.toBeInTheDocument();
  });
});

describe('SimulationAssumptions — portfolio action', () => {
  it('shows the current market price, unmodified, with no Rate Assumptions row', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(PORTFOLIO, { collateralDelta: 1, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText('$50,000.00 (current, unmodified)')).toBeInTheDocument();
    expect(screen.queryByText('Rate Assumptions')).not.toBeInTheDocument();
  });
});

/**
 * "Manual-Data Status" — V1.1 Batch 6 ("Data Freshness & Live-Status
 * UX"), new. Before this batch Simulation had no way to tell a user
 * whether a result was based on fresh live data, stale live data, or
 * manual assumptions at all — see this component's own updated header
 * comment. Both new props are optional; every test above (which never
 * passes them) proves the row is simply omitted, not broken.
 */
describe('SimulationAssumptions — V1.1 Batch 6: Manual-Data Status', () => {
  function runAndRender(
    protocolStatus?: ProtocolStatusKind,
    marketUpdatedAt?: string,
    portfolio: ApplicationPortfolio = PORTFOLIO,
  ) {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(portfolio, { collateralDelta: 0, debtDelta: 0 });
    render(
      <SimulationAssumptions
        portfolio={portfolio}
        protocolStatus={protocolStatus}
        marketUpdatedAt={marketUpdatedAt}
      />,
    );
  }

  it('omits the row entirely when marketUpdatedAt is not supplied (every pre-Batch-6 caller)', () => {
    runAndRender(undefined, undefined);
    expect(screen.queryByText('Manual-Data Status')).not.toBeInTheDocument();
  });

  it('shows a real V4 status (e.g. stale) when both props are supplied', () => {
    const status: ProtocolStatusKind = {
      version: 'v4',
      status: 'stale',
      // V4 Mixed-Provenance UX batch — only `.status` is asserted below.
      breakdown: {
        market: { btcPrice: 'live', baseDrawnApr: 'live' },
        position: 'live',
        collateralRisk: 'live',
      },
    };
    runAndRender(status, '2026-01-01T00:00:00.000Z');
    expect(screen.getByText('Manual-Data Status')).toBeInTheDocument();
    expect(screen.getByText('Aave V4 · Stale')).toBeInTheDocument();
  });

  it('with marketUpdatedAt but no protocolStatus and marketSource "manual": shows the original Manual Mode copy', () => {
    runAndRender(undefined, '2026-01-01T00:00:00.000Z', { ...PORTFOLIO, marketSource: 'manual' });
    expect(screen.getByText(/Manual Mode/)).toBeInTheDocument();
    expect(screen.getByText(/No live data provider is connected/)).toBeInTheDocument();
  });

  it('with marketUpdatedAt but no protocolStatus and marketSource "live" (V3, live-synced on a different page): states it is live-synced, never "No live data provider is connected"', () => {
    runAndRender(undefined, '2026-01-01T00:00:00.000Z', { ...PORTFOLIO, marketSource: 'live' });
    expect(screen.getByText(/Live-synced/)).toBeInTheDocument();
    expect(screen.queryByText(/No live data provider is connected/)).not.toBeInTheDocument();
  });
});
