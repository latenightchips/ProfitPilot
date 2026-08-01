import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SaveLoopStrategyForm } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Save Loop Strategy Form — 06_TASKS.md M7-017 ("save" half). Store:
 * "Saved strategies, Assumptions."
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

describe('SaveLoopStrategyForm — empty state', () => {
  it('prompts for a strategy before any calculation has run', () => {
    render(<SaveLoopStrategyForm portfolioId="p1" portfolioUpdatedAt="t1" />);
    expect(screen.getByText(/Configure a strategy to save it/i)).toBeInTheDocument();
  });
});

describe('SaveLoopStrategyForm — saving', () => {
  it('blocks submission with an alert when Name is empty', () => {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<SaveLoopStrategyForm portfolioId="p1" portfolioUpdatedAt="t1" />);
    fireEvent.click(screen.getByRole('button', { name: /Save Strategy/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
    expect(useLoopBuilderStore.getState().savedStrategies).toHaveLength(0);
  });

  it('saves successfully, threading portfolioId/portfolioUpdatedAt through', () => {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<SaveLoopStrategyForm portfolioId="p1" portfolioUpdatedAt="t1" />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Loop' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Strategy/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    const saved = useLoopBuilderStore.getState().savedStrategies;
    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('My Loop');
    expect(saved[0].portfolioId).toBe('p1');
    expect(saved[0].portfolioUpdatedAt).toBe('t1');
  });
});
