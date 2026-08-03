import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ExitFeasibilityAnalysis } from '@/features/exit-planner';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Exit Feasibility Analysis — 06_TASKS.md M7-027. DoD: "Infeasible
 * targets return explicit reasons and possible adjustments."
 */
const INITIAL_STATE = {
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
  useExitPlannerStore.setState(INITIAL_STATE);
});

describe('ExitFeasibilityAnalysis — empty state', () => {
  it('prompts for an exit target before any calculation has run', () => {
    render(<ExitFeasibilityAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText(/Configure an exit target/i)).toBeInTheDocument();
  });
});

describe('ExitFeasibilityAnalysis — a feasible target', () => {
  it('shows Feasible: Yes and no alert', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<ExitFeasibilityAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText('Feasible').nextElementSibling?.textContent).toBe('Yes');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('echoes the real Available Collateral and Debt Obligations that were checked', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<ExitFeasibilityAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText('Available Collateral').nextElementSibling?.textContent).toMatch(
      /2 BTC/,
    );
    expect(screen.getByText('Debt Obligations').nextElementSibling?.textContent).toMatch(
      /\$20,000/,
    );
  });

  it('shows the requested Target Health Factor only for that exit type', () => {
    useExitPlannerStore.getState().setExitType('targetHealthFactor');
    useExitPlannerStore.getState().setTargetInputs({ targetHealthFactor: 8 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<ExitFeasibilityAnalysis portfolio={validPortfolio()} />);
    // "Target Health Factor" legitimately appears twice: once as the
    // "Exit Type" row's own value, once as this type-specific row's
    // own label (paired with the real requested value, "8").
    const labels = screen.getAllByText('Target Health Factor');
    expect(labels).toHaveLength(2);
    const targetRow = labels.find((el) => el.tagName === 'DT');
    expect(targetRow?.nextElementSibling?.textContent).toBe('8');
    expect(screen.queryByText('Requested Retained BTC')).not.toBeInTheDocument();
  });

  it('shows the requested Requested Retained BTC only for that exit type', () => {
    useExitPlannerStore.getState().setExitType('targetRetainedBtc');
    useExitPlannerStore.getState().setTargetInputs({ targetRetainedBtc: 1.8 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<ExitFeasibilityAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText('Requested Retained BTC').nextElementSibling?.textContent).toBe('1.8');
    expect(screen.queryByText('Target Health Factor')).not.toBeInTheDocument();
  });

  it('cites Conflict #8 for Transaction Costs and Conflict #10 for Requested Proceeds', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<ExitFeasibilityAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText(/Conflict #8/)).toBeInTheDocument();
    expect(screen.getByText(/Conflict #10/)).toBeInTheDocument();
  });
});

describe('ExitFeasibilityAnalysis — an infeasible target (DoD)', () => {
  it('shows Feasible: No, the real reason, and a possible adjustment inside a role="alert"', () => {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 25000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<ExitFeasibilityAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText('Feasible').nextElementSibling?.textContent).toBe('No');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/negative/i);
    expect(alert.textContent).toMatch(/Possible adjustment/i);
  });
});
