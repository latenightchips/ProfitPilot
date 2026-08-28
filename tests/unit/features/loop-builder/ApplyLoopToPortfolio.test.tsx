import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplyLoopToPortfolio } from '@/features/loop-builder';
import { V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * `ApplyLoopToPortfolio` — V1.1 Batch 3, Section 5. Mirrors
 * `ApplyLoopAsSimulation.test.tsx`'s own setup; this component's real
 * mutation target is `usePortfolioStore` (not `useSimulationStore`).
 */
const LOOP_INITIAL_STATE = {
  settings: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedStrategies: [],
  selectedStrategyId: null,
  sensitivityResult: null,
  sensitivityErrors: [],
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
  useLoopBuilderStore.setState(LOOP_INITIAL_STATE);
  usePortfolioStore.setState(PORTFOLIO_INITIAL_STATE);
  window.localStorage.clear();
});

function createValidPortfolio(overrides: Record<string, unknown> = {}): Portfolio {
  const result = usePortfolioStore.getState().create({
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.7, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    ...overrides,
  });
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

describe('ApplyLoopToPortfolio — empty state', () => {
  it('prompts for a viable strategy before any calculation has run', () => {
    const portfolio = createValidPortfolio();
    render(<ApplyLoopToPortfolio portfolio={portfolio} />);
    expect(screen.getByText(/Configure a viable strategy/i)).toBeInTheDocument();
  });
});

describe('ApplyLoopToPortfolio — review then apply', () => {
  it('shows a review panel with the disclaimer, then writes the real final collateral/debt on confirm', () => {
    const portfolio = createValidPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    const strategy = useLoopBuilderStore.getState().currentResult?.strategy;
    if (strategy === undefined || strategy === null) throw new Error('setup failed');

    render(<ApplyLoopToPortfolio portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Review Apply to Portfolio/i }));

    expect(screen.getByText(/does not execute transactions on Aave/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Apply to Portfolio$/i }));

    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.portfolio.collateral.quantity).toBe(strategy.finalCollateral.quantity);
    expect(record.portfolio.debt.balance).toBe(strategy.finalDebt);
    expect(screen.getByRole('status')).toHaveTextContent('Applied to portfolio.');
  });

  it('Cancel discards the review without mutating the portfolio or creating a history snapshot', () => {
    const portfolio = createValidPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopToPortfolio portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Review Apply to Portfolio/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.portfolio.collateral.quantity).toBe(2);
    expect(record.portfolio.debt.balance).toBe(0);
    expect(screen.getByRole('button', { name: /Review Apply to Portfolio/i })).toBeInTheDocument();
  });
});

describe('ApplyLoopToPortfolio — V4 ambiguous borrow', () => {
  // `usePortfolioStore().create()` validates via `portfolioInputSchema`,
  // which does not include V4 fields (they are set via their own narrow
  // actions, never via `create`'s input) — so V4 identity/state must be
  // set with the real actions afterward, the same pattern
  // `portfolioStore.test.ts`'s own V4 fixtures already use, not passed
  // as `create()` overrides (which would be silently dropped).
  function v4Portfolio(): Portfolio {
    const portfolio = createValidPortfolio({ debt: { asset: 'USDC', balance: 20500 } });
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(
        portfolio.id,
        { collateralFactor: 0.8, dynamicConfigKey: 1 },
        'manual',
      );
    usePortfolioStore
      .getState()
      .setAaveV4DebtState(
        portfolio.id,
        { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.13 },
        'manual',
      );
    const updated = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    return updated;
  }

  it('disables Review and shows the risk-premium message for a real new V4 borrow', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<ApplyLoopToPortfolio portfolio={portfolio} />);
    expect(screen.getByRole('button', { name: /Review Apply to Portfolio/i })).toBeDisabled();
    expect(screen.getByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).toBeInTheDocument();
  });

  it('does not mutate the portfolio when Review is disabled, even if clicked', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    const applyPortfolioState = vi.spyOn(usePortfolioStore.getState(), 'applyPortfolioState');
    render(<ApplyLoopToPortfolio portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Review Apply to Portfolio/i }));

    expect(applyPortfolioState).not.toHaveBeenCalled();
    expect(screen.queryByText(/does not execute transactions on Aave/i)).not.toBeInTheDocument();
    applyPortfolioState.mockRestore();
  });
});
