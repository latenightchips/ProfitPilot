import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import ExitPlannerPage from '@/app/exit-planner/page';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Exit Planner Route — 06_TASKS.md M7-019. DoD: "Users can access the
 * Exit Planner from the Dashboard and strategy navigation." Include:
 * "Exit target controls, Current portfolio baseline, Exit result, Debt
 * repayment breakdown, Retained BTC, Cash proceeds, Warnings."
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
  useExitPlannerStore.setState({
    exitType: null,
    targetInputs: null,
    currentResult: null,
    status: 'idle',
    errors: [],
    warnings: [],
    lastMetadata: null,
    savedPlans: [],
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
  return created.data;
}

describe('ExitPlannerPage — no active portfolio', () => {
  it('shows a prompt to select or create a portfolio instead of the strategy tools', () => {
    render(<ExitPlannerPage />);
    expect(screen.getByText(/No portfolio is currently selected/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Exit Target Controls')).not.toBeInTheDocument();
  });
});

describe('ExitPlannerPage — active portfolio (Include items)', () => {
  it('renders every named real region: Exit Target Controls, Current Portfolio Baseline, Warnings', () => {
    selectActivePortfolio();
    render(<ExitPlannerPage />);
    expect(screen.getByLabelText('Exit Target Controls')).toBeInTheDocument();
    expect(screen.getByText('Current Portfolio Baseline')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
  });

  it('labels the not-yet-built Exit Result section, citing M7-024/M7-025, without hiding it', () => {
    selectActivePortfolio();
    render(<ExitPlannerPage />);
    expect(screen.getByText('Exit Result')).toBeInTheDocument();
    expect(screen.getByText(/M7-024/)).toBeInTheDocument();
    expect(screen.getByText(/M7-025/)).toBeInTheDocument();
  });

  it('lets a user pick a type and see a real, computed exit result end-to-end', async () => {
    const user = userEvent.setup();
    selectActivePortfolio();
    render(<ExitPlannerPage />);

    await user.click(screen.getByRole('button', { name: 'Full Exit' }));

    expect(useExitPlannerStore.getState().currentResult).not.toBeNull();
    expect(useExitPlannerStore.getState().currentResult?.feasible).toBe(true);
  });

  it('renders a Warnings section sourced from the Exit Planner Store specifically', () => {
    const portfolio = selectActivePortfolio();
    // A repayment amount larger than the entire current debt resolves
    // to a negative target debt balance — genuinely infeasible, the
    // same real (not hand-crafted) case `exitPlannerStore.test.ts`
    // already covers in isolation.
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 999999 });
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ExitPlannerPage />);
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(useExitPlannerStore.getState().warnings.length).toBeGreaterThan(0);
  });
});
