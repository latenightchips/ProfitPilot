import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { TargetHealthFactorResult } from '@/features/exit-planner';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Target Health Factor Result — 06_TASKS.md M7-026. DoD: "The
 * resulting state is independently verified against the target."
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

describe('TargetHealthFactorResult — not applicable', () => {
  it('renders nothing for a different exit type', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const { container } = render(<TargetHealthFactorResult />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing before the target field has been supplied', () => {
    useExitPlannerStore.getState().setExitType('targetHealthFactor');

    const { container } = render(<TargetHealthFactorResult />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TargetHealthFactorResult — a real Target Health Factor result', () => {
  function runTargetHealthFactor() {
    useExitPlannerStore.getState().setExitType('targetHealthFactor');
    useExitPlannerStore.getState().setTargetInputs({ targetHealthFactor: 8 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
  }

  it('shows the real collateral sale, debt repayment, and BTC retained', () => {
    runTargetHealthFactor();
    render(<TargetHealthFactorResult />);
    expect(screen.getByText('Debt Repayment').nextElementSibling?.textContent).toBe('10000.00 USD');
    expect(screen.getByText('Resulting Health Factor')).toBeInTheDocument();
  });

  it('shows a real, non-zero Difference From Target, explained in plain language without exposing the internal Formula ID or PROJECT_STATUS.md conflict reference (UX punch-list item 8)', () => {
    runTargetHealthFactor();
    render(<TargetHealthFactorResult />);
    const difference = screen.getByText('Difference From Target').nextElementSibling?.textContent;
    expect(difference).not.toBe('+0');
    expect(screen.getByText(/A small non-zero difference is expected/)).toBeInTheDocument();
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/F-0\d\d\d/);
    expect(bodyText).not.toMatch(/Conflict #\d+/);
    expect(bodyText).not.toContain('PROJECT_STATUS.md');
  });

  it('shows a real, exact "+0" difference with the non-destructive style when the target already matches the current Health Factor (no sale needed)', () => {
    // The portfolio's own current Health Factor is exactly 4
    // (100000 * 0.8 / 20000) — requesting that same value needs no
    // sale at all (btcSold: 0), so F-040's own fixed-collateral
    // approximation is exact here, not an undershoot.
    useExitPlannerStore.getState().setExitType('targetHealthFactor');
    useExitPlannerStore.getState().setTargetInputs({ targetHealthFactor: 4 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    render(<TargetHealthFactorResult />);
    const differenceEl = screen.getByText('Difference From Target').nextElementSibling;
    expect(differenceEl?.textContent).toBe('+0');
    expect(differenceEl?.className).toContain('text-foreground');
  });
});
