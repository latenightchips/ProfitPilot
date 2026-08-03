import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { FullExitResult } from '@/features/exit-planner';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Full Exit Result — 06_TASKS.md M7-024. DoD: "The full-exit result
 * reconciles with current portfolio balances."
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

describe('FullExitResult — not applicable', () => {
  it('renders nothing before any calculation has run', () => {
    const { container } = render(<FullExitResult />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a genuinely partial exit result', () => {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 10000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const { container } = render(<FullExitResult />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an infeasible target', () => {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 25000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const { container } = render(<FullExitResult />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('FullExitResult — a genuine full-exit result (DoD: reconciles with portfolio balances)', () => {
  function runFullExit() {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
  }

  it('shows real BTC Sold and Debt Repaid figures', () => {
    runFullExit();
    render(<FullExitResult />);
    expect(screen.getByText('BTC Sold').nextElementSibling?.textContent).toBe('0.40000000');
    expect(screen.getByText('Debt Repaid').nextElementSibling?.textContent).toMatch(/\$20,000/);
  });

  it('shows Gross Sale Value equal to Debt Repaid — the reconciliation this DoD asks for', () => {
    runFullExit();
    render(<FullExitResult />);
    const grossSaleValue = screen.getByText('Gross Sale Value').nextElementSibling?.textContent;
    const debtRepaid = screen.getByText('Debt Repaid').nextElementSibling?.textContent;
    expect(grossSaleValue).toBe(debtRepaid);
  });

  it('shows a real, non-zero Annual Interest Cost Eliminated', () => {
    runFullExit();
    render(<FullExitResult />);
    // before.interestCost (20000 * 0.05 = 1000) minus after.interestCost (0 debt = 0).
    expect(
      screen.getByText('Annual Interest Cost Eliminated').nextElementSibling?.textContent,
    ).toMatch(/\$1,000/);
  });

  it('shows Net Cash Proceeds as a real, computed $0.00 with an explanatory note, not "Not available"', () => {
    runFullExit();
    render(<FullExitResult />);
    expect(screen.getByText('Net Cash Proceeds').nextElementSibling?.textContent).toMatch(
      /\$0\.00/,
    );
    expect(screen.getByText(/Conflict #10/)).toBeInTheDocument();
  });

  it('shows Remaining Collateral and Remaining Debt reconciling with the portfolio', () => {
    runFullExit();
    render(<FullExitResult />);
    expect(screen.getByText('Remaining Collateral').nextElementSibling?.textContent).toMatch(
      /1\.60000000 BTC/,
    );
    expect(screen.getByText('Remaining Debt').nextElementSibling?.textContent).toMatch(/\$0\.00/);
  });

  it('itemizes swap fees, slippage, and gas estimate as not itemized (conflict #8)', () => {
    runFullExit();
    render(<FullExitResult />);
    expect(screen.getByText('Swap Fees')).toBeInTheDocument();
    expect(screen.getByText('Slippage')).toBeInTheDocument();
    expect(screen.getByText('Gas Estimate')).toBeInTheDocument();
    expect(screen.getAllByText(/Not itemized —/).length).toBe(3);
  });
});
