import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { formatHealthFactor } from '@/components/strategy/format';
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

/**
 * "Applied — ..." confirmation message — V4 Readiness Audit §12 Stage 25
 * follow-up. Closes a real, reproduced bug: the message used to read
 * `useSimulationStore.portfolioActionPreview` reactively — a Store
 * shared with Simulation's own Portfolio Action feature and Loop
 * Builder's `ApplyLoopAsSimulation`. A stale result left over from any
 * of those (or an earlier exit-plan attempt with different numbers)
 * showed as "Applied" with the WRONG Health Factor even though nothing
 * was ever clicked in THIS render, or even though the exit target had
 * since changed. Fixed by snapshotting the applied Health Factor/BTC-sold
 * locally, only at the moment `handleApply` actually runs, and clearing
 * that snapshot whenever the underlying transaction changes.
 */
describe('ApplyExitPlanAsSimulation — "Applied" confirmation is never stale (Stage 25 follow-up)', () => {
  it('shows no "Applied" message before the button has ever been clicked, even with a stale portfolioActionPreview already in the Store', () => {
    // Simulates a stale global Store value left over from an unrelated
    // apply (Loop Builder, Simulation's own Portfolio Action, or an
    // earlier exit-plan attempt) — never touched by anything in this
    // render.
    useSimulationStore.setState({
      portfolioActionPreview: {
        before: { healthFactor: 1.73 } as never,
        after: { healthFactor: 1.73 } as never,
        profitOrLoss: 0,
      },
    });

    const portfolio = validPortfolio();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ApplyExitPlanAsSimulation portfolio={portfolio} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/Applied —/)).not.toBeInTheDocument();
  });

  it('shows the real, freshly-applied Health Factor after clicking, not a stale one already sitting in the Store', () => {
    // A stale, wrong Health Factor sitting in the Store before the click —
    // proves the click overwrites it with the real result, not the display
    // merely tolerating it being absent.
    useSimulationStore.setState({
      portfolioActionPreview: {
        before: { healthFactor: 1.73 } as never,
        after: { healthFactor: 1.73 } as never,
        profitOrLoss: 0,
      },
    });

    const portfolio = validPortfolio();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ApplyExitPlanAsSimulation portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Exit Plan as Simulation/i }));

    const status = screen.getByRole('status');
    expect(status.textContent).not.toMatch(/1\.73/);
    // A Full Exit on this fixture produces Health Factor Infinity (zero
    // remaining debt) — the real, freshly-computed result.
    expect(status.textContent).toMatch(/Applied —/);
  });

  it('clears a previously-shown "Applied" message once the exit target changes, rather than leaving it referring to stale numbers', () => {
    const portfolio = validPortfolio();
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 5000 });
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    const { rerender } = render(<ApplyExitPlanAsSimulation portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Exit Plan as Simulation/i }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    // The user edits the repayment amount after applying — a genuinely
    // different transaction, never re-applied.
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 8000 });
    useExitPlannerStore.getState().runExitCalculation(portfolio);
    rerender(<ApplyExitPlanAsSimulation portfolio={portfolio} />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText(/Applied —/)).not.toBeInTheDocument();
  });

  it('shows a matching Health Factor and BTC-sold figure together — never a mix of a fresh transaction with a stale Health Factor', () => {
    const portfolio = validPortfolio();
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 10000 });
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ApplyExitPlanAsSimulation portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Apply Exit Plan as Simulation/i }));

    const preview = useSimulationStore.getState().portfolioActionPreview;
    expect(preview).not.toBeNull();
    const status = screen.getByRole('status');
    // 0.2 BTC sold to raise the $10,000 repayment at $50,000/BTC.
    expect(status.textContent).toContain('0.200000 BTC sold');
    expect(status.textContent).toContain(formatHealthFactor(preview!.after.healthFactor));
  });
});
