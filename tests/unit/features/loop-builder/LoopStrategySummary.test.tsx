import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { LoopStrategySummary } from '@/features/loop-builder';
import type { ApplicationPortfolio } from '@/services';
import { V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE } from '@/services';
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

  it('itemizes Estimated Implementation Cost as unavailable rather than fabricating a figure, when no assumptions are configured (V4 Readiness Audit §12 P1-6)', () => {
    useLoopBuilderStore.getState().setSettings({
      targetBorrowPercentage: 0.5,
      maxLoops: 3,
      minHealthFactor: 1.1,
    });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    render(<LoopStrategySummary portfolio={validPortfolio()} />);
    expect(screen.getByText('Estimated Implementation Cost')).toBeInTheDocument();
    expect(screen.getByText(/Cannot be honestly totaled/)).toBeInTheDocument();
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('02_Formulas.md');
    expect(bodyText).not.toContain('Formula ID');
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

/**
 * BLOCKER #3 fix — a real new V4 borrow must never present an exact-
 * looking post-loop Health Factor/liquidation state built on a silently
 * carried-forward `riskPremium`. `riskPremium: 0.13` is a deliberately
 * distinctive value (unused elsewhere in this file) so an accidental
 * carry-forward into a rendered figure would be numerically obvious.
 */
describe('LoopStrategySummary — V4 ambiguous borrow shows the risk-premium message, not a fabricated comparison (BLOCKER #3 fix)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return validPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.13 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
      ...overrides,
    });
  }

  it('shows the risk-premium message and renders "—" for the proposed column when the strategy actually borrows more', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult?.strategy?.finalDebt).toBeGreaterThan(
      20000 + 500,
    );

    render(<LoopStrategySummary portfolio={portfolio} />);
    expect(screen.getByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).toBeInTheDocument();
    const cells = screen.getAllByText('—');
    expect(cells.length).toBeGreaterThan(0);
  });

  it('does not show the risk-premium message for a zero-loop V4 strategy (no real borrow occurred)', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 0, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult?.strategy?.finalDebt).toBeCloseTo(
      20000 + 500,
      6,
    );

    render(<LoopStrategySummary portfolio={portfolio} />);
    expect(screen.queryByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).not.toBeInTheDocument();
  });

  it('never shows the risk-premium message for a V3 portfolio, regardless of how much the strategy borrows', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    render(<LoopStrategySummary portfolio={portfolio} />);
    expect(screen.queryByText(V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE)).not.toBeInTheDocument();
  });
});
