import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import SimulationPage from '@/app/simulation/page';
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
});
