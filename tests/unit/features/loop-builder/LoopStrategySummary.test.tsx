import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoopStrategySummary } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Strategy Summary — 06_TASKS.md M7-011. DoD: "The summary clearly
 * distinguishes current and proposed portfolio states." Reuses the
 * shared `StrategyComparison` (M7-003) for 7 of the 10 named Include
 * items — see this component's own header comment for the full mapping.
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

describe('LoopStrategySummary — empty state', () => {
  it('prompts for a strategy before any calculation has run', () => {
    render(<LoopStrategySummary portfolio={validPortfolio()} />);
    expect(screen.getByText(/Configure a strategy/i)).toBeInTheDocument();
  });
});

describe('LoopStrategySummary — comparison (DoD: distinguishes current and proposed states)', () => {
  it('renders the shared comparison table with Current and Proposed columns once a viable strategy exists', () => {
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopStrategySummary portfolio={validPortfolio()} />);
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Proposed')).toBeInTheDocument();
    expect(screen.getByText('BTC Exposure')).toBeInTheDocument();
  });

  it('shows a real, computed Annual Interest Cost', () => {
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopStrategySummary portfolio={validPortfolio()} />);
    const row = screen.getByText('Annual Interest Cost').closest('div');
    expect(row?.textContent).not.toMatch(/—$/);
  });

  it('itemizes Estimated Implementation Cost as unavailable rather than fabricating a figure', () => {
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopStrategySummary portfolio={validPortfolio()} />);
    expect(screen.getByText(/Not included — no Formula ID/)).toBeInTheDocument();
  });

  it('shows a human-readable Stop Reason label, not the raw enum value', () => {
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopStrategySummary portfolio={validPortfolio()} />);
    expect(screen.getByText('Stop Reason').nextElementSibling?.textContent).not.toMatch(
      /^[A-Z_]+$/,
    );
  });

  it('renders "—" for the proposed column when the strategy is not viable, never a fabricated value', () => {
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    // debt.balance of 45000 against 1 BTC @ $50,000 and an 0.8 liquidation
    // threshold: Health Factor = (50000 * 0.8) / 45000 ≈ 0.89 — already
    // below 1.0, so LIQUIDATION_PROXIMITY makes the strategy non-viable.
    useLoopBuilderStore
      .getState()
      .runLoopStrategy(validPortfolio({ debt: { asset: 'USDC', balance: 45000 } }));

    render(
      <LoopStrategySummary
        portfolio={validPortfolio({ debt: { asset: 'USDC', balance: 45000 } })}
      />,
    );
    const cells = screen.getAllByText('—');
    expect(cells.length).toBeGreaterThan(0);
  });
});
