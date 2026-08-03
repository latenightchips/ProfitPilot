import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SaveExitPlanForm } from '@/features/exit-planner';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Save Exit Plan Form — 06_TASKS.md M7-029 ("save" half). Store: "Name,
 * Portfolio reference, Exit type, Targets, Results, Assumptions,
 * Warnings, Timestamp, Engine and Formula versions."
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

describe('SaveExitPlanForm — empty state', () => {
  it('prompts for a plan before any calculation has run', () => {
    render(<SaveExitPlanForm portfolioId="p1" portfolioUpdatedAt="t1" />);
    expect(screen.getByText(/Configure an exit plan to save it/i)).toBeInTheDocument();
  });
});

describe('SaveExitPlanForm — saving', () => {
  it('blocks submission with an alert when Name is empty', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<SaveExitPlanForm portfolioId="p1" portfolioUpdatedAt="t1" />);
    fireEvent.click(screen.getByRole('button', { name: /Save Plan/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
    expect(useExitPlannerStore.getState().savedPlans).toHaveLength(0);
  });

  it('saves successfully, threading portfolioId/portfolioUpdatedAt through', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<SaveExitPlanForm portfolioId="p1" portfolioUpdatedAt="t1" />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Exit Plan' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Plan/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    const saved = useExitPlannerStore.getState().savedPlans;
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('My Exit Plan');
    expect(saved[0].portfolioId).toBe('p1');
    expect(saved[0].portfolioUpdatedAt).toBe('t1');
    expect(saved[0].exitType).toBe('fullExit');
  });
});
