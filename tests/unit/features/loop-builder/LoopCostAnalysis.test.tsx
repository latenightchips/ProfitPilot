import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoopCostAnalysis } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Cost Analysis — 06_TASKS.md M7-014. Display: "Total interest
 * cost, Monthly interest cost, Implementation costs (itemized),
 * Break-even appreciation needed, Effective leverage achieved."
 */
const INITIAL_STATE = {
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

function validPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

beforeEach(() => {
  useLoopBuilderStore.setState(INITIAL_STATE);
});

describe('LoopCostAnalysis — empty state', () => {
  it('prompts for a viable strategy before any calculation has run', () => {
    render(<LoopCostAnalysis />);
    expect(screen.getByText(/Configure a viable strategy/i)).toBeInTheDocument();
  });
});

describe('LoopCostAnalysis — a viable strategy', () => {
  function runViableStrategy() {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
  }

  it('shows the real Effective Leverage Achieved', () => {
    runViableStrategy();
    render(<LoopCostAnalysis />);
    expect(screen.getByText('Effective Leverage Achieved').nextElementSibling?.textContent).toMatch(
      /x$/,
    );
  });

  it('shows real, distinct Annual and Monthly Interest Cost values', () => {
    runViableStrategy();
    render(<LoopCostAnalysis />);
    const annual = screen.getByText('Total (Annual) Interest Cost').nextElementSibling?.textContent;
    const monthly = screen.getByText('Monthly Interest Cost').nextElementSibling?.textContent;
    expect(annual).not.toBe('—');
    expect(monthly).not.toBe('—');
    expect(annual).not.toBe(monthly);
  });

  it('shows a real Break-Even BTC Appreciation percentage', () => {
    runViableStrategy();
    render(<LoopCostAnalysis />);
    expect(
      screen.getByText('Break-Even BTC Appreciation Needed').nextElementSibling?.textContent,
    ).toMatch(/%/);
  });

  it('itemizes swap fees, slippage, gas estimate, and total implementation cost as not itemized', () => {
    runViableStrategy();
    render(<LoopCostAnalysis />);
    expect(screen.getByText('Swap Fees')).toBeInTheDocument();
    expect(screen.getByText('Slippage')).toBeInTheDocument();
    expect(screen.getByText('Gas Estimate')).toBeInTheDocument();
    expect(screen.getByText('Total Implementation Cost')).toBeInTheDocument();
    expect(screen.getAllByText(/Not itemized —/).length).toBe(4);
  });
});
