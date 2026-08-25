import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SimulationPage from '@/app/simulation/page';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Simulation Workspace Route — 06_TASKS.md M6-001 ("Create Simulation
 * Workspace") + M6-004 ("Create Scenario Builder", Batch 3). DoD:
 * "Users can access the Simulation Workspace from the Dashboard";
 * "Scenario inputs are validated before calculation."
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
}

describe('SimulationPage — no active portfolio (M6-001)', () => {
  it('guides the user to select or create one, rather than rendering an empty Scenario Builder', () => {
    render(<SimulationPage />);
    expect(screen.getByRole('heading', { name: 'Simulation', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/No portfolio is currently selected/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Select or create one' })).toHaveAttribute(
      'href',
      '/portfolios',
    );
    expect(screen.queryByRole('heading', { name: 'Scenario Controls' })).not.toBeInTheDocument();
  });
});

describe('SimulationPage — active portfolio (M6-001, M6-004)', () => {
  it('renders the three named regions from M6-001’s own Include list, plus Scenario Charts (M6-011, Batch 10), Scenario Timeline (M6-012, Batch 11), Simulation Assumptions (M6-013, Batch 12), Simulation Warnings (M6-014, Batch 13), and Save Scenario (M6-015, Batch 14)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByRole('heading', { name: 'Scenario Controls' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simulation Results' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Portfolio Comparison' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scenario Charts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scenario Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simulation Assumptions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simulation Warnings' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Save Scenario' })).toBeInTheDocument();
  });

  it('exposes the Scenario Controls region as a landmark for assistive technology', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByRole('complementary', { name: 'Scenario Controls' })).toBeInTheDocument();
  });

  it('renders the Scenario Builder’s own BTC Price input, pre-filled with the portfolio’s current price', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByLabelText('BTC Price')).toHaveValue(50000);
  });

  it('does not render the Milestone 1 placeholder text anymore', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.queryByText(/scaffolded in Milestone 1/)).not.toBeInTheDocument();
  });

  it('renders the real Scenario Summary in place of the M6-001 Simulation Results placeholder (M6-009, Batch 8)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByText('Change a scenario input to see results here.')).toBeInTheDocument();
  });

  it('renders the real Scenario Comparison in place of the M6-001 Portfolio Comparison placeholder (M6-010, Batch 9)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByText(/No scenarios saved yet/)).toBeInTheDocument();
    expect(
      screen.queryByText('Implemented in a later Milestone 6 batch — see PROJECT_STATUS.md.'),
    ).not.toBeInTheDocument();
  });

  it('renders the real Scenario Charts section (M6-011, Batch 10)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(
      screen.getByText('Select scenarios in Portfolio Comparison above to see charts.'),
    ).toBeInTheDocument();
  });

  it('renders the real Scenario Timeline section (M6-012, Batch 11)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(
      screen.getByText('Change Borrow Rate or Holding Period to see the timeline.'),
    ).toBeInTheDocument();
  });

  it('renders the real Simulation Assumptions section (M6-013, Batch 12)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByText('Run a simulation to see its assumptions.')).toBeInTheDocument();
  });

  it('renders the real Simulation Warnings section (M6-014, Batch 13)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByText('Run a simulation to see any warnings.')).toBeInTheDocument();
  });

  it('renders the real Save Scenario section (M6-015, Batch 14)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByText('Run a price or interest scenario to save it.')).toBeInTheDocument();
  });
});

/**
 * 06_TASKS.md M9-012 ("Audit State Management") — "No cross-portfolio
 * contamination." Found during this audit, not assumed: `useSimulationStore`'s
 * `currentResult`/`currentScenario` are never cleared when the active
 * portfolio changes, and `ScenarioSummary` renders `currentResult`
 * directly with no portfolio cross-check of its own — so a result
 * computed against a previously-active portfolio remained visible after
 * switching to a different one. Fixed by keying the Scenario workspace's
 * portfolio-scoped subtree on `activePortfolioId`, the same mechanism
 * `PortfolioDetailsForm` (M4-010) already established for this exact
 * class of problem ("Remounted on portfolio switch" — see
 * `PROJECT_STATUS.md`), plus `ScenarioBuilder` calling
 * `useSimulationStore`'s `syncActivePortfolio` on mount/`portfolioId`
 * change — which clears the Store's working state only on a genuine
 * portfolio change, never on a same-portfolio remount, since a key
 * remount alone only clears local React state, not the external
 * Zustand store.
 */
describe('SimulationPage — cross-portfolio contamination (M9-012)', () => {
  beforeEach(() => {
    useSimulationStore.getState().reset();
  });

  it('clears a stale simulation result computed against a previously-active portfolio when the active portfolio changes', () => {
    const createdA = usePortfolioStore.getState().create(validInput({ name: 'Portfolio A' }));
    if (!createdA.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(createdA.data.id);

    render(<SimulationPage />);

    const portfolioA = usePortfolioStore.getState().portfolios[createdA.data.id]?.portfolio;
    if (!portfolioA) throw new Error('setup failed');
    act(() => {
      useSimulationStore.getState().setCurrentScenario({
        type: 'price',
        priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
      });
      useSimulationStore.getState().runSimulation(portfolioA);
    });

    // PT-11's Scenario Builder fieldset legend shares this text with
    // ScenarioSummary's own result-section span, so both are present at
    // once (2) before the switch, and only the legend remains (1) after.
    expect(screen.getAllByText('Price / Interest Scenario')).toHaveLength(2);

    act(() => {
      const createdB = usePortfolioStore.getState().create(validInput({ name: 'Portfolio B' }));
      if (!createdB.ok) throw new Error('setup failed');
      usePortfolioStore.getState().select(createdB.data.id);
    });

    expect(screen.getAllByText('Price / Interest Scenario')).toHaveLength(1);
    expect(screen.getByText('Change a scenario input to see results here.')).toBeInTheDocument();
  });

  /**
   * Regression coverage for manually-verified V3/V4 portfolio isolation:
   * switching between a V4 and a V3 portfolio must clear the stale result
   * (already covered above for two V3 portfolios), and re-running the
   * simulation after each switch must recompute its baseline Health
   * Factor from THAT portfolio's own real protocol parameters — a V4
   * portfolio's `v4CollateralRisk.collateralFactor`, never
   * `protocol.liquidationThreshold` (deliberately set to a different
   * value here so a leak would be numerically visible). Switching back
   * to the original V4 portfolio must restore its exact original
   * baseline Health Factor, not a value crossed from V3.
   */
  it('switching V4 -> V3 -> back to V4 recomputes the baseline Health Factor from each portfolio’s own protocol and restores the original V4 value on return', () => {
    const createdV4 = usePortfolioStore.getState().create(
      validInput({
        collateral: { asset: 'BTC', quantity: 2 },
        debt: { asset: 'USDC', balance: 999999 },
        market: { btcPriceUsd: 60000 },
        protocol: {
          maxLoanToValue: 0.7,
          liquidationThreshold: 0.9,
          borrowApr: 0.05,
          supplyApr: 0.02,
        },
      }),
    );
    if (!createdV4.ok) throw new Error('setup failed');
    usePortfolioStore.getState().setProtocolVersion(createdV4.data.id, 'v4');
    usePortfolioStore.getState().setAaveV4Position(createdV4.data.id, {
      userAddress: '0x1234567890123456789012345678901234567890',
    });
    usePortfolioStore.getState().setAaveV4DebtState(createdV4.data.id, {
      drawnDebt: 30000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
      debtAssetPriceUsd: 1.0,
    });
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(createdV4.data.id, { collateralFactor: 0.75, dynamicConfigKey: 1 });
    usePortfolioStore.getState().select(createdV4.data.id);
    const v4 = usePortfolioStore.getState().portfolios[createdV4.data.id].portfolio;

    // V4 Readiness Audit §12 Stage 24 — Simulation gates the entire
    // Scenario Controls/Results subtree (including the M9-012
    // `syncActivePortfolio` wiring this test exercises) on canonical V4
    // live status; a V4 portfolio whose live-sync status is still the
    // default `'idle'` never mounts `ScenarioBuilder` at all, so it must
    // be marked live here for this test to observe real user-visible
    // behavior, exactly as the equivalent Exit Planner test already does.
    // The fetch actions are also stubbed (not just `status` patched):
    // `SimulationPageClient` mounts `useAaveV4Sync` unconditionally, and
    // without a stub its real fetch would flip `status` back to
    // `'loading'` on every portfolio switch (a real network call in a
    // jsdom test), re-closing the gate before `syncActivePortfolio` could
    // ever fire — a test-environment artifact, not real app behavior.
    useAaveV4LiveDataStore.setState({
      status: 'ready',
      lastFetchedAt: new Date().toISOString(),
      fetchAaveV4LiveData: vi.fn().mockResolvedValue(undefined),
    });
    useAaveV4CollateralRiskLiveDataStore.setState({
      status: 'ready',
      lastFetchedAt: new Date().toISOString(),
      fetchAaveV4CollateralRiskLiveData: vi.fn().mockResolvedValue(undefined),
    });

    render(<SimulationPage />);

    act(() => {
      useSimulationStore.getState().setCurrentScenario({
        type: 'price',
        priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
      });
      useSimulationStore.getState().runSimulation(v4);
    });
    // (2 BTC x $60,000 x collateralFactor 0.75) / (drawnDebt 30000 +
    // premiumDebt 500) — never protocol.liquidationThreshold (0.9).
    expect(useSimulationStore.getState().currentResult?.baseline.healthFactor).toBeCloseTo(
      (2 * 60000 * 0.75) / 30500,
      9,
    );

    const createdV3 = usePortfolioStore.getState().create(
      validInput({
        name: 'V3 Portfolio',
        collateral: { asset: 'BTC', quantity: 1.5 },
        debt: { asset: 'USDC', balance: 26000 },
        market: { btcPriceUsd: 50000 },
        protocol: {
          maxLoanToValue: 0.7,
          liquidationThreshold: 0.8,
          borrowApr: 0.05,
          supplyApr: 0.02,
        },
      }),
    );
    if (!createdV3.ok) throw new Error('setup failed');
    act(() => {
      usePortfolioStore.getState().select(createdV3.data.id);
    });
    expect(useSimulationStore.getState().currentResult).toBeNull();

    act(() => {
      useSimulationStore.getState().setCurrentScenario({
        type: 'price',
        priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      });
      useSimulationStore.getState().runSimulation(createdV3.data);
    });
    expect(useSimulationStore.getState().currentResult?.baseline.healthFactor).toBeCloseTo(
      (1.5 * 50000 * 0.8) / 26000,
      9,
    );

    act(() => {
      usePortfolioStore.getState().select(v4.id);
    });
    expect(useSimulationStore.getState().currentResult).toBeNull();

    act(() => {
      useSimulationStore.getState().setCurrentScenario({
        type: 'price',
        priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
      });
      useSimulationStore.getState().runSimulation(v4);
    });
    expect(useSimulationStore.getState().currentResult?.baseline.healthFactor).toBeCloseTo(
      (2 * 60000 * 0.75) / 30500,
      9,
    );
  });
});

/**
 * Exit Planner → Simulation handoff — a real, reported bug. Manual
 * testing found: applying a Target Debt Balance exit plan (funded by
 * selling collateral) as a simulation showed the correct before/after
 * result (Debt, Health Factor, Liquidation Price, Profit/Loss all
 * changed correctly) — but the visible Portfolio Action "Collateral
 * Change (BTC)"/"Debt Change (USD)" fields kept showing `0`, as if no
 * action had been configured. Investigation confirmed the underlying
 * calculation was already correct (the collateral delta genuinely
 * applied); the bug was that `ScenarioBuilder`'s own local form fields
 * had no way to learn about a portfolio action applied from outside it
 * (`ApplyExitPlanAsSimulation.tsx` calls `runPortfolioActionSimulation`
 * directly on the Store). Fixed by storing the applied
 * `PortfolioActionSimulationInput` on the Store and syncing
 * `ScenarioBuilder` from it. This test reproduces the full state/render
 * round trip end to end, at the page level.
 */
describe('SimulationPage — applied-exit-plan state/render round trip (Exit Planner handoff fix)', () => {
  it('shows the real applied Collateral/Debt Change alongside the already-correct before/after result, not 0/0', () => {
    const created = usePortfolioStore.getState().create(validInput());
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);
    const portfolio = created.data;

    render(<SimulationPage />);

    // Exactly what ApplyExitPlanAsSimulation's handleApply does for a
    // Target Debt Balance plan that repays $10,000 by selling 0.2 BTC
    // (funded at $50,000/BTC) — a self-financed transaction, not a
    // debt-only reduction.
    act(() => {
      useSimulationStore.getState().runPortfolioActionSimulation(portfolio, {
        collateralDelta: -0.2,
        debtDelta: -10000,
      });
    });

    // The before/after result was already correct pre-fix — still is.
    // "Portfolio Action" appears twice (the Scenario Controls legend and
    // the Simulation Results section span — PT-11's own grouping design).
    expect(screen.getAllByText('Portfolio Action').length).toBeGreaterThan(0);
    // Debt row renders as "$20,000.00 → $10,000.00" in one combined node.
    expect(screen.getByText(/\$20,000\.00.*\$10,000\.00/)).toBeInTheDocument();

    // The bug: these used to stay at 0 regardless of the applied deltas.
    expect(screen.getByLabelText('Collateral Change (BTC)')).toHaveValue(-0.2);
    expect(screen.getByLabelText('Debt Change (USD)')).toHaveValue(-10000);
  });
});
