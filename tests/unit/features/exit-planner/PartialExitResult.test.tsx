import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { PartialExitResult } from '@/features/exit-planner';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Partial Exit Result — 06_TASKS.md M7-025. DoD: "The user can
 * understand the portfolio state after the proposed exit."
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

describe('PartialExitResult — not applicable', () => {
  it('renders nothing before any calculation has run', () => {
    const { container } = render(<PartialExitResult />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a genuine full-exit result', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const { container } = render(<PartialExitResult />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an infeasible target', () => {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 25000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const { container } = render(<PartialExitResult />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PartialExitResult — a genuine partial-exit result', () => {
  function runPartialRepayment() {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 10000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
  }

  it('shows all 8 named Display items with real computed values', () => {
    runPartialRepayment();
    render(<PartialExitResult />);
    expect(screen.getByText('BTC Sold').nextElementSibling?.textContent).toBe('0.20000000');
    expect(screen.getByText('Debt Repaid').nextElementSibling?.textContent).toMatch(/\$10,000/);
    expect(screen.getByText('BTC Retained').nextElementSibling?.textContent).toBe('1.80000000');
    expect(screen.getByText('Debt Retained').nextElementSibling?.textContent).toMatch(/\$10,000/);
    expect(screen.getByText('Resulting Equity').nextElementSibling?.textContent).toMatch(
      /\$80,000/,
    );
    expect(screen.getByText('Resulting Health Factor').nextElementSibling?.textContent).toBe('7.2');
    expect(
      screen.getByText('Resulting Liquidation Price').nextElementSibling?.textContent,
    ).not.toBe('—');
  });

  it('itemizes swap fees, slippage, and gas estimate as not itemized (conflict #8)', () => {
    runPartialRepayment();
    render(<PartialExitResult />);
    expect(screen.getAllByText(/Not itemized —/).length).toBe(3);
  });
});
