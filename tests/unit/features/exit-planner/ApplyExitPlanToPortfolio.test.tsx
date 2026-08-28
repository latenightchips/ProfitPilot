import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplyExitPlanToPortfolio } from '@/features/exit-planner';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/** `ApplyExitPlanToPortfolio` — V1.1 Batch 3, Section 6. */
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

const PORTFOLIO_INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

beforeEach(() => {
  useExitPlannerStore.setState(EXIT_INITIAL_STATE);
  usePortfolioStore.setState(PORTFOLIO_INITIAL_STATE);
  window.localStorage.clear();
});

function createValidPortfolio(overrides: Record<string, unknown> = {}): Portfolio {
  const result = usePortfolioStore.getState().create({
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    ...overrides,
  });
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

describe('ApplyExitPlanToPortfolio — empty state', () => {
  it('prompts for a feasible exit target before any calculation has run', () => {
    const portfolio = createValidPortfolio();
    render(<ApplyExitPlanToPortfolio portfolio={portfolio} />);
    expect(screen.getByText(/Configure a feasible exit target/i)).toBeInTheDocument();
  });

  it('prompts again for an infeasible target rather than exposing Apply for garbage', () => {
    const portfolio = createValidPortfolio();
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 999999 });
    useExitPlannerStore.getState().runExitCalculation(portfolio);

    render(<ApplyExitPlanToPortfolio portfolio={portfolio} />);
    expect(screen.getByText(/Configure a feasible exit target/i)).toBeInTheDocument();
  });
});

describe('ApplyExitPlanToPortfolio — review then apply', () => {
  it('a full exit shows the disclaimer, then writes the real repaid/sold state on confirm — including a real Infinity Health Factor', () => {
    const portfolio = createValidPortfolio();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(portfolio);
    const transaction = useExitPlannerStore.getState().currentResult?.transaction;
    if (transaction === undefined || transaction === null) throw new Error('setup failed');

    render(<ApplyExitPlanToPortfolio portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Review Apply to Portfolio/i }));
    expect(screen.getByText(/does not execute transactions on Aave/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Apply to Portfolio$/i }));

    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.portfolio.debt.balance).toBeCloseTo(20000 - transaction.repayment, 6);
    expect(record.portfolio.collateral.quantity).toBeCloseTo(2 - transaction.btcSold, 6);
    expect(record.summary.ok).toBe(true);
    if (!record.summary.ok) return;
    // A full exit's remaining debt is 0 -> a real Infinity Health Factor.
    expect(record.summary.data.healthFactor).toBe(Infinity);
    expect(screen.getByRole('status')).toHaveTextContent('Applied to portfolio.');
  });

  it('Cancel discards the review without mutating the portfolio', () => {
    const portfolio = createValidPortfolio();
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(portfolio);
    const applyPortfolioState = vi.spyOn(usePortfolioStore.getState(), 'applyPortfolioState');

    render(<ApplyExitPlanToPortfolio portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Review Apply to Portfolio/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(applyPortfolioState).not.toHaveBeenCalled();
    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.portfolio.debt.balance).toBe(20000);
    applyPortfolioState.mockRestore();
  });
});
