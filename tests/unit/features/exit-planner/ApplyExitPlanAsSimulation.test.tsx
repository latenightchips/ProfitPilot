import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ApplyExitPlanAsSimulation } from '@/features/exit-planner';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Apply Exit Plan as Simulation — 06_TASKS.md M7-044 ("Create Cross-Tool
 * Workflow Tests"). See this component's own header comment for why a
 * nominally test-only task added this real production component,
 * mirroring `ApplyLoopAsSimulation.test.tsx`'s own test shape.
 */
const EXIT_INITIAL_STATE = {
  exitType: null,
  targetInputs: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  priceSensitivity: null,
  priceSensitivityErrors: [],
  savedPlans: [],
  selectedPlanId: null,
};

const SIMULATION_INITIAL_STATE = {
  currentScenario: null,
  currentResult: null,
  portfolioActionPreview: null,
  savedScenarios: [],
  comparisonSelection: [],
  timelineProjection: null,
  lastMetadata: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  previewMode: false,
};

function validPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

beforeEach(() => {
  useExitPlannerStore.setState(EXIT_INITIAL_STATE);
  useSimulationStore.setState(SIMULATION_INITIAL_STATE);
});

describe('ApplyExitPlanAsSimulation — empty state', () => {
  it('prompts for a feasible exit target before any calculation has run', () => {
    render(<ApplyExitPlanAsSimulation portfolio={validPortfolio()} />);
    expect(screen.getByText(/Configure a feasible exit target/i)).toBeInTheDocument();
  });

  it('prompts again for an infeasible target rather than applying garbage', () => {
    const portfolio = validPortfolio();
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 999999 });
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ApplyExitPlanAsSimulation portfolio={portfolio} />);
    expect(screen.getByText(/Configure a feasible exit target/i)).toBeInTheDocument();
  });
});

describe('ApplyExitPlanAsSimulation — applying', () => {
  it('computes the real collateral/debt delta from the exit transaction and applies it via runPortfolioActionSimulation, without touching currentScenario/currentResult', () => {
    const portfolio = validPortfolio();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ApplyExitPlanAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Exit Plan as Simulation/i }).click();

    const simState = useSimulationStore.getState();
    expect(simState.portfolioActionPreview).not.toBeNull();
    expect(simState.currentScenario).toBeNull();
    expect(simState.currentResult).toBeNull();

    // A Full Exit repays the entire $20,000 debt by selling exactly
    // enough BTC (0.4 BTC at $50,000) — both real Engine-computed
    // deltas, not fabricated.
    expect(simState.portfolioActionPreview?.after.debtValue).toBe(0);
  });

  it('shows a real Health Factor before is different from after applying', () => {
    const portfolio = validPortfolio();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ApplyExitPlanAsSimulation portfolio={portfolio} />);
    screen.getByRole('button', { name: /Apply Exit Plan as Simulation/i }).click();

    const preview = useSimulationStore.getState().portfolioActionPreview;
    expect(preview).not.toBeNull();
    expect(preview?.before.healthFactor).not.toBe(preview?.after.healthFactor);
  });

  it('renders a link to the Simulation Workspace with the correct href', () => {
    const portfolio = validPortfolio();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ApplyExitPlanAsSimulation portfolio={portfolio} />);
    expect(screen.getByRole('link', { name: /Open Simulation Workspace/i })).toHaveAttribute(
      'href',
      '/simulation',
    );
  });
});
