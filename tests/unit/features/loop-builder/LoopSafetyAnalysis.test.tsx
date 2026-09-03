import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoopSafetyAnalysis } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Safety Analysis — 06_TASKS.md M7-013. Display: "Minimum Health
 * Factor reached, Distance to liquidation, Maximum LTV reached,
 * Remaining borrowing capacity, Configured safety limits, Stop
 * condition, Risk classification." See this component's own header
 * comment for the full field-mapping/reuse rationale.
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

describe('LoopSafetyAnalysis — empty state', () => {
  it('prompts for a strategy before any calculation has run', () => {
    render(<LoopSafetyAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText(/Configure a strategy/i)).toBeInTheDocument();
  });
});

describe('LoopSafetyAnalysis — a healthy, viable strategy', () => {
  it('shows No for both Minimum Health Factor Reached and Maximum LTV Reached', () => {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopSafetyAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText('Minimum Health Factor Reached').nextElementSibling?.textContent).toBe(
      'No',
    );
    expect(screen.getByText('Maximum LTV Reached').nextElementSibling?.textContent).toBe('No');
  });

  it('shows a real, non-dash Distance to Liquidation', () => {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopSafetyAnalysis portfolio={validPortfolio()} />);
    const value = screen.getByText('Distance to Liquidation').nextElementSibling?.textContent;
    expect(value).not.toBe('—');
    expect(value).toMatch(/%/);
  });

  it('shows a real, non-dash Remaining Borrowing Capacity', () => {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopSafetyAnalysis portfolio={validPortfolio()} />);
    const value = screen.getByText('Remaining Borrowing Capacity').nextElementSibling?.textContent;
    expect(value).not.toBe('—');
  });

  it('renders the exact configured safety limits', () => {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopSafetyAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText('Borrow Percentage Per Step').nextElementSibling?.textContent).toBe(
      '50.00%',
    );
    expect(screen.getByText('Maximum Number of Loops').nextElementSibling?.textContent).toBe('3');
    expect(screen.getByText('Minimum Health Factor').nextElementSibling?.textContent).toBe('1.1');
    expect(screen.getByText('Maximum LTV').nextElementSibling?.textContent).toBe('50.00%');
  });

  it('renders a human-readable Stop Condition', () => {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopSafetyAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText('Stop Condition').nextElementSibling?.textContent).not.toMatch(
      /^[A-Z_]+$/,
    );
  });

  it('explains Risk Classification in plain language, rather than fabricating a band or citing an internal conflict reference (UX-06 same-class fix)', () => {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopSafetyAnalysis portfolio={validPortfolio()} />);
    const text = screen.getByText((_, element) => element?.textContent === 'Risk Classification')
      .nextElementSibling?.textContent;
    expect(text).toMatch(/Not shown/);
    expect(text).not.toMatch(/PROJECT_STATUS\.md/);
    expect(text).not.toMatch(/Conflict #\d+/);
  });
});

describe('LoopSafetyAnalysis — a triggered safety finding', () => {
  it('shows Yes for Minimum Health Factor Reached when a real finding is triggered', () => {
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopSafetyAnalysis portfolio={validPortfolio()} />);
    expect(screen.getByText('Minimum Health Factor Reached').nextElementSibling?.textContent).toBe(
      'Yes',
    );
  });
});

/**
 * BLOCKER #2 fix — "Configured Safety Limits" must report the same
 * canonical V4 risk-capacity value `services/loop/strategy.ts` actually
 * dispatched for the strategy shown above it, never the legacy
 * `portfolio.protocol.maxLoanToValue`. `protocol.maxLoanToValue` here is
 * deliberately `0.5` (50%) while `v4CollateralRisk.collateralFactor` is
 * `0.65` (65%) — a different value, so leakage would be numerically
 * obvious rather than coincidentally matching.
 */
describe('LoopSafetyAnalysis — V4 canonical risk-capacity display (BLOCKER #2 fix)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return validPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
    });
  }

  it('reports Collateral Factor (never "Maximum LTV") as the real V4 collateralFactor (65%) when no override is set — never the legacy protocol.maxLoanToValue (50%)', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    // Guard against a silent Service-level failure making this a
    // false-positive pass (the "Collateral Factor" row still renders from
    // `settings` even when `currentResult` reflects an error).
    expect(useLoopBuilderStore.getState().currentResult?.strategy).not.toBeNull();

    render(<LoopSafetyAnalysis portfolio={portfolio} />);
    // V4 semantic audit, Batch 2 (A1) — the label itself must say
    // "Collateral Factor" for a V4 portfolio, not the V3-only "Maximum LTV".
    expect(screen.queryByText('Maximum LTV')).not.toBeInTheDocument();
    expect(screen.getByText('Collateral Factor').nextElementSibling?.textContent).toBe('65.00%');
  });

  it('reports the same Collateral Factor the strategy actually used when an explicit maxLoanToValueOverride is set', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
      maxLoanToValueOverride: 0.4,
    });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult?.strategy).not.toBeNull();

    render(<LoopSafetyAnalysis portfolio={portfolio} />);
    expect(screen.queryByText('Maximum LTV')).not.toBeInTheDocument();
    expect(screen.getByText('Collateral Factor').nextElementSibling?.textContent).toBe('40.00%');
  });

  it('labels "Maximum LTV Reached" as "Collateral Factor Reached" for a V4 portfolio', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<LoopSafetyAnalysis portfolio={portfolio} />);
    expect(screen.queryByText('Maximum LTV Reached')).not.toBeInTheDocument();
    expect(screen.getByText('Collateral Factor Reached')).toBeInTheDocument();
  });
});

/**
 * BLOCKER #3 fix — "Distance to Liquidation" must never present an
 * exact-looking figure built on a silently carried-forward `riskPremium`
 * after a real new V4 borrow. `riskPremium: 0.13` is a deliberately
 * distinctive value (unused elsewhere in this file).
 */
describe('LoopSafetyAnalysis — V4 ambiguous borrow (BLOCKER #3 fix)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return validPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.13 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
    });
  }

  it('shows "—" and the risk-premium message for Distance to Liquidation when the strategy actually borrows more', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult?.strategy?.finalDebt).toBeGreaterThan(
      15500,
    );

    render(<LoopSafetyAnalysis portfolio={portfolio} />);
    expect(screen.getByText('Distance to Liquidation').nextElementSibling?.textContent).toBe('—');
    expect(screen.getByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).toBeInTheDocument();
  });

  it('does not show the risk-premium message for a zero-loop V4 strategy, and Distance to Liquidation is real', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 0, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult?.strategy?.finalDebt).toBeCloseTo(15500, 6);

    render(<LoopSafetyAnalysis portfolio={portfolio} />);
    expect(screen.queryByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).not.toBeInTheDocument();
    const distanceValue =
      screen.getByText('Distance to Liquidation').nextElementSibling?.textContent;
    expect(distanceValue).not.toBe('—');
    expect(distanceValue).toMatch(/%/);
  });

  it('never shows the risk-premium message for a V3 portfolio', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<LoopSafetyAnalysis portfolio={portfolio} />);
    expect(screen.queryByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).not.toBeInTheDocument();
  });
});
