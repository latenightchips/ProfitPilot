import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoopScenarioSensitivity } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Scenario Sensitivity — 06_TASKS.md M7-015. Display: "Health
 * Factor under stress, Liquidation distance under stress, Equity under
 * stress, Debt cost under stress." All 4 satisfied by `ScenarioSummary`.
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

function runViableStrategy() {
  useLoopBuilderStore
    .getState()
    .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
  useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
}

describe('LoopScenarioSensitivity — empty state', () => {
  it('prompts for a viable strategy before any calculation has run', () => {
    render(<LoopScenarioSensitivity portfolio={validPortfolio()} />);
    expect(screen.getByText(/Configure a viable strategy/i)).toBeInTheDocument();
  });
});

describe('LoopScenarioSensitivity — presets', () => {
  it('shows all 4 Display metrics after running the price-decline preset', () => {
    runViableStrategy();
    render(<LoopScenarioSensitivity portfolio={validPortfolio()} />);

    fireEvent.click(screen.getByRole('button', { name: /BTC Price Decline/i }));

    expect(screen.getByText('Health Factor')).toBeInTheDocument();
    expect(screen.getByText('Liquidation Distance')).toBeInTheDocument();
    expect(screen.getByText('Equity')).toBeInTheDocument();
    expect(screen.getByText('Debt Cost')).toBeInTheDocument();
  });

  it('runs the rate-increase preset and shows a real result', () => {
    runViableStrategy();
    render(<LoopScenarioSensitivity portfolio={validPortfolio()} />);

    fireEvent.click(screen.getByRole('button', { name: /Borrow-Rate Increase/i }));

    expect(useLoopBuilderStore.getState().sensitivityResult).not.toBeNull();
  });

  it('combined stress shows a worse (lower) Health Factor than price decline alone', () => {
    runViableStrategy();
    render(<LoopScenarioSensitivity portfolio={validPortfolio()} />);

    fireEvent.click(screen.getByRole('button', { name: /BTC Price Decline/i }));
    const priceOnly = useLoopBuilderStore.getState().sensitivityResult?.scenario.healthFactor;

    fireEvent.click(screen.getByRole('button', { name: /Combined Stress/i }));
    const combined = useLoopBuilderStore.getState().sensitivityResult?.scenario.healthFactor;

    expect(combined).toBeLessThan(priceOnly ?? Infinity);
  });

  it('runs a custom scenario from the inline form', () => {
    runViableStrategy();
    render(<LoopScenarioSensitivity portfolio={validPortfolio()} />);

    fireEvent.click(screen.getByRole('button', { name: /Run Custom Scenario/i }));

    expect(useLoopBuilderStore.getState().sensitivityResult).not.toBeNull();
  });

  it('applies an explicit custom Borrow APR, overriding the effective rate', () => {
    runViableStrategy();
    render(<LoopScenarioSensitivity portfolio={validPortfolio()} />);

    fireEvent.change(screen.getByLabelText(/Custom Borrow APR/i), { target: { value: '0.3' } });
    fireEvent.click(screen.getByRole('button', { name: /Run Custom Scenario/i }));

    const withCustomRate = useLoopBuilderStore.getState().sensitivityResult?.scenario.debtCost;

    fireEvent.change(screen.getByLabelText(/Custom Borrow APR/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Run Custom Scenario/i }));

    const withEffectiveRate = useLoopBuilderStore.getState().sensitivityResult?.scenario.debtCost;

    expect(withCustomRate).not.toBe(withEffectiveRate);
  });

  it('shows the alert when the Engine genuinely rejects a scenario (e.g. a -100% price change)', () => {
    runViableStrategy();
    render(<LoopScenarioSensitivity portfolio={validPortfolio()} />);

    fireEvent.change(screen.getByLabelText(/Custom BTC Price Change/i), {
      target: { value: '-1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Custom Scenario/i }));

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
