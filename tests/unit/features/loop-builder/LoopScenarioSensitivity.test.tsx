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

/**
 * V4 Rate Increase / Combined Stress — V4 Readiness Audit §12 Stage 17
 * (Part 3). Before this stage, both presets stressed only the V3-only
 * `scenario.borrowApr` field, which `services/simulation/scenario.ts`'s
 * V4 branch never reads — a genuinely inert preset for a V4 portfolio.
 * Implementing the fix also surfaced a second, deeper defect:
 * `services/loop/finalPortfolio.ts`'s `buildFinalLoopPortfolio` dropped
 * `protocolVersion`/`v4DebtState` entirely, so even a correctly-populated
 * `scenario.v4RateStress` could never reach the real V4 branch — fixed
 * there (see that file's own header comment), verified together here.
 */
describe('LoopScenarioSensitivity — V4 Rate Increase / Combined actually stress the V4 result (Stage 17)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return validPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
    });
  }

  function runViableV4Strategy(portfolio: ApplicationPortfolio) {
    useLoopBuilderStore
      .getState()
      .setSettings({ targetBorrowPercentage: 0.3, maxLoops: 2, minHealthFactor: 1.2 });
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
  }

  it('Borrow-Rate Increase changes the V4 scenario debt cost relative to the (unstressed) baseline — not a silent no-op', () => {
    const portfolio = v4Portfolio();
    runViableV4Strategy(portfolio);
    render(<LoopScenarioSensitivity portfolio={portfolio} />);

    fireEvent.click(screen.getByRole('button', { name: /Borrow-Rate Increase/i }));

    const result = useLoopBuilderStore.getState().sensitivityResult;
    expect(result).not.toBeNull();
    if (result === null) return;
    // Before Stage 17's fix (either half of it), this was exactly equal —
    // scenario.v4RateStress was either never set, or set but unreachable
    // because the final portfolio had already lost its V4 identity.
    expect(result.scenario.debtCost).not.toBeCloseTo(result.baseline.debtCost, 2);
  });

  it('Combined Stress applies both the price decline AND the rate stress — its debt cost differs from a price-decline-only run', () => {
    const portfolio = v4Portfolio();
    runViableV4Strategy(portfolio);
    render(<LoopScenarioSensitivity portfolio={portfolio} />);

    fireEvent.click(screen.getByRole('button', { name: /BTC Price Decline/i }));
    const priceOnlyDebtCost = useLoopBuilderStore.getState().sensitivityResult?.scenario.debtCost;

    fireEvent.click(screen.getByRole('button', { name: /Combined Stress/i }));
    const combinedDebtCost = useLoopBuilderStore.getState().sensitivityResult?.scenario.debtCost;

    // A pure price-decline scenario never touches v4RateStress, so its
    // debtCost equals the (unstressed) baseline — Combined must differ
    // from it specifically because of the added rate stress, not just
    // because of the price change (which itself does not move debtCost).
    expect(combinedDebtCost).not.toBeCloseTo(priceOnlyDebtCost ?? NaN, 2);
  });

  it('a V4 rate-increase scenario still reports a worse (lower) Health Factor than the unstressed baseline, via the real V4 debt projection', () => {
    const portfolio = v4Portfolio();
    runViableV4Strategy(portfolio);
    render(<LoopScenarioSensitivity portfolio={portfolio} />);

    fireEvent.click(screen.getByRole('button', { name: /Borrow-Rate Increase/i }));

    const result = useLoopBuilderStore.getState().sensitivityResult;
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.scenario.healthFactor).toBeLessThanOrEqual(result.baseline.healthFactor);
  });
});

/**
 * V3 unaffected — V4 Readiness Audit §12 Stage 17. Same presets, same
 * assertions the pre-existing "LoopScenarioSensitivity — presets" describe
 * block above already covers for a V3 portfolio; this block exists
 * specifically to make the "no V3 regression" claim an explicit,
 * independently-readable test rather than an inference from unrelated
 * passing tests.
 */
describe('LoopScenarioSensitivity — V3 sensitivity scenarios remain unchanged (Stage 17)', () => {
  it('Borrow-Rate Increase still stresses scenario.borrowApr for a V3 portfolio, producing a real debtCost difference from baseline', () => {
    runViableStrategy();
    render(<LoopScenarioSensitivity portfolio={validPortfolio()} />);

    fireEvent.click(screen.getByRole('button', { name: /Borrow-Rate Increase/i }));

    const result = useLoopBuilderStore.getState().sensitivityResult;
    expect(result).not.toBeNull();
    if (result === null) return;
    expect(result.scenario.debtCost).not.toBeCloseTo(result.baseline.debtCost, 2);
  });

  it('Combined Stress still applies both stresses for a V3 portfolio', () => {
    runViableStrategy();
    render(<LoopScenarioSensitivity portfolio={validPortfolio()} />);

    fireEvent.click(screen.getByRole('button', { name: /BTC Price Decline/i }));
    const priceOnlyDebtCost = useLoopBuilderStore.getState().sensitivityResult?.scenario.debtCost;

    fireEvent.click(screen.getByRole('button', { name: /Combined Stress/i }));
    const combinedDebtCost = useLoopBuilderStore.getState().sensitivityResult?.scenario.debtCost;

    expect(combinedDebtCost).not.toBeCloseTo(priceOnlyDebtCost ?? NaN, 2);
  });
});
