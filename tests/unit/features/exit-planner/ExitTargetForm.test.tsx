import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExitTargetForm } from '@/features/exit-planner';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Exit Target Form — 06_TASKS.md M7-022. Requirements: "Use React Hook
 * Form and Zod. Clearly distinguish target price from current price."
 * DoD: "Invalid or impossible target inputs are rejected with useful
 * messages." Also covers M7-023 ("Implement Exit Calculation
 * Workflow")'s own UI-triggering wiring.
 */
const INITIAL_STATE = {
  exitType: null,
  targetInputs: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedPlans: [],
};

function validPortfolio(): ApplicationPortfolio {
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
  };
}

beforeEach(() => {
  useExitPlannerStore.setState(INITIAL_STATE);
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ExitTargetForm — empty state', () => {
  it('prompts to select an exit approach before any type has been chosen', () => {
    render(<ExitTargetForm portfolio={validPortfolio()} />);
    expect(screen.getByText(/Select an exit approach/i)).toBeInTheDocument();
  });
});

describe('ExitTargetForm — Full Exit (no field to type into)', () => {
  it('triggers a real calculation on its own, with no numeric input required', () => {
    useExitPlannerStore.setState({ exitType: 'fullExit' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);

    expect(useExitPlannerStore.getState().currentResult).not.toBeNull();
    expect(useExitPlannerStore.getState().currentResult?.feasible).toBe(true);
  });

  it('still renders the shared Target BTC Price field', () => {
    useExitPlannerStore.setState({ exitType: 'fullExit' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);
    expect(screen.getByLabelText(/Target BTC Price/i)).toBeInTheDocument();
  });
});

describe('ExitTargetForm — per-type field visibility (M7-021 Requirement)', () => {
  it('shows only the Debt Repayment Amount field for Partial Debt Repayment', () => {
    useExitPlannerStore.setState({ exitType: 'partialDebtRepayment' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);
    expect(screen.getByLabelText('Debt Repayment Amount (USD)')).toBeInTheDocument();
    expect(screen.queryByLabelText('Target Health Factor')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('BTC Quantity to Retain')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Target Debt Balance (USD)')).not.toBeInTheDocument();
  });

  it('shows only the Target Health Factor field for that type', () => {
    useExitPlannerStore.setState({ exitType: 'targetHealthFactor' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);
    expect(screen.getByLabelText('Target Health Factor')).toBeInTheDocument();
    expect(screen.queryByLabelText('Debt Repayment Amount (USD)')).not.toBeInTheDocument();
  });

  it('shows only the BTC Quantity to Retain field for Target Retained BTC', () => {
    useExitPlannerStore.setState({ exitType: 'targetRetainedBtc' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);
    expect(screen.getByLabelText('BTC Quantity to Retain')).toBeInTheDocument();
  });

  it('shows only the Target Debt Balance field for that type', () => {
    useExitPlannerStore.setState({ exitType: 'targetDebtBalance' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);
    expect(screen.getByLabelText('Target Debt Balance (USD)')).toBeInTheDocument();
  });
});

describe('ExitTargetForm — deterministic, debounced, validated updates', () => {
  it('does not call the Service before the debounce window elapses', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    useExitPlannerStore.setState({ exitType: 'partialDebtRepayment' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);

    await user.type(screen.getByLabelText('Debt Repayment Amount (USD)'), '5000');
    expect(useExitPlannerStore.getState().currentResult).toBeNull();
  });

  it('reaches the real Exit Planning Service with valid inputs after the debounce window', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    useExitPlannerStore.setState({ exitType: 'partialDebtRepayment' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);

    await user.type(screen.getByLabelText('Debt Repayment Amount (USD)'), '5000');
    await vi.advanceTimersByTimeAsync(500);

    const state = useExitPlannerStore.getState();
    expect(state.targetInputs?.repaymentAmount).toBe(5000);
    expect(state.currentResult?.feasible).toBe(true);
    expect(state.currentResult?.transaction?.repayment).toBe(5000);
  });

  it('never reaches the Service while the type-specific field is invalid (DoD: rejected with useful messages)', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    useExitPlannerStore.setState({ exitType: 'targetHealthFactor' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);

    await user.type(screen.getByLabelText('Target Health Factor'), '-1');
    await vi.advanceTimersByTimeAsync(500);

    expect(screen.getByText(/Too small|Number must be|greater than/i)).toBeInTheDocument();
    expect(useExitPlannerStore.getState().currentResult).toBeNull();
  });

  it('shows a validation error for a non-positive Target BTC Price, the shared field itself', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    useExitPlannerStore.setState({ exitType: 'fullExit' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);

    await user.type(screen.getByLabelText(/Target BTC Price/i), '-1');
    await vi.advanceTimersByTimeAsync(500);

    expect(screen.getByText(/Too small|Number must be|greater than/i)).toBeInTheDocument();
  });

  it('applies a Target BTC Price override on top of the type-specific field', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    useExitPlannerStore.setState({ exitType: 'fullExit' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);

    await user.type(screen.getByLabelText(/Target BTC Price/i), '25000');
    await vi.advanceTimersByTimeAsync(500);

    const state = useExitPlannerStore.getState();
    expect(state.targetInputs?.scenarioBtcPriceUsd).toBe(25000);
    expect(state.currentResult?.transaction?.btcSold).toBeCloseTo(0.8, 10);
  });
});

describe('ExitTargetForm — switching type remounts with a clean form', () => {
  it('does not carry a value typed for one type over to a different type', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    useExitPlannerStore.setState({ exitType: 'partialDebtRepayment' });
    render(<ExitTargetForm portfolio={validPortfolio()} />);

    await user.type(screen.getByLabelText('Debt Repayment Amount (USD)'), '5000');

    act(() => {
      useExitPlannerStore.setState({ exitType: 'targetDebtBalance', targetInputs: null });
    });

    expect(screen.getByLabelText('Target Debt Balance (USD)')).toHaveValue(null);
  });
});
