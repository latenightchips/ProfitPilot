import { describe, expect, it } from 'vitest';

import { calculateExitPosition, type ExitPositionInput } from '@/engine/exit/calculateExitPosition';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseInput(overrides: Partial<ExitPositionInput> = {}): ExitPositionInput {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 48000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    targetDebt: 0,
    ...overrides,
  };
}

/**
 * Execution-cost friction propagation — V4 Readiness Audit §12 P1-5.
 * `calculateExitPosition` must pass `executionCostAssumptions` straight
 * through to `calculateBtcSaleRequired` (F-071), never reimplement the
 * friction arithmetic itself.
 */
describe('calculateExitPosition — execution-cost friction propagation (P1-5)', () => {
  it('omitted executionCostAssumptions reproduces the exact pre-P1-5 frictionless btcSold', () => {
    const result = calculateExitPosition(baseInput({ targetDebt: 24000 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.btcSold).toBeCloseTo(0.4, 8);
  });

  it('non-zero friction increases btcSold, reducing btcRetained/remainingCollateralValue/remainingEquity accordingly', () => {
    const frictionless = calculateExitPosition(baseInput({ targetDebt: 24000 }));
    const frictioned = calculateExitPosition(
      baseInput({
        targetDebt: 24000,
        executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
      }),
    );
    expect(frictionless.ok && frictioned.ok).toBe(true);
    if (!frictionless.ok || !frictioned.ok) return;

    expect(frictioned.value.btcSold).toBeGreaterThan(frictionless.value.btcSold);
    expect(frictioned.value.btcRetained).toBeLessThan(frictionless.value.btcRetained);
    expect(frictioned.value.remainingCollateralValue).toBeLessThan(
      frictionless.value.remainingCollateralValue,
    );
    expect(frictioned.value.remainingEquity).toBeLessThan(frictionless.value.remainingEquity);
    // Repayment and remaining debt are untouched by friction — only the
    // BTC-sale leg is affected.
    expect(frictioned.value.repayment).toBe(frictionless.value.repayment);
    expect(frictioned.value.remainingDebt).toBe(frictionless.value.remainingDebt);
  });
});

/**
 * Execution-cost reporting — V4 Readiness Audit §12 P1-6. Composes
 * F-072/F-073 (already-approved P1-5 primitives) to turn the pre-P1-6
 * always-unavailable itemization into real computed dollar figures, once
 * the product layer supplies what each item needs. An exit is always
 * exactly one modeled transaction (`EXIT_TRANSACTION_COUNT`).
 */
describe('calculateExitPosition — execution-cost reporting (P1-6)', () => {
  it('computes real swapFees/slippage/gasEstimate/totalImplementationCost, given full execution inputs', () => {
    const result = calculateExitPosition(
      baseInput({
        targetDebt: 24000,
        executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
        gasCostUsd: 15,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // notional = repayment = 24000. swapFeeCost = 24000 x 0.003 = 72;
    // slippageCost = 24000 x 0.997 x 0.005 = 119.64; gas = 1 x $15 = $15.
    const byItem = Object.fromEntries(result.value.costs.map((entry) => [entry.item, entry]));
    expect(byItem.swapFees!.amountUsd).toBeCloseTo(72, 6);
    expect(byItem.slippage!.amountUsd).toBeCloseTo(119.64, 6);
    expect(byItem.gasEstimate!.amountUsd).toBe(15);
    expect(byItem.totalImplementationCost!.amountUsd).toBeCloseTo(206.64, 6);
    for (const entry of result.value.costs) {
      expect(entry.reason).toBeUndefined();
    }
  });

  it('gas configured alone computes a real gasEstimate while swapFees/slippage/total stay unavailable', () => {
    const result = calculateExitPosition(baseInput({ targetDebt: 24000, gasCostUsd: 8 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byItem = Object.fromEntries(result.value.costs.map((entry) => [entry.item, entry]));
    expect(byItem.gasEstimate!.amountUsd).toBe(8);
    expect(byItem.swapFees!.amountUsd).toBeNull();
    expect(byItem.slippage!.amountUsd).toBeNull();
    expect(byItem.totalImplementationCost!.amountUsd).toBeNull();
  });

  it('explicit zero assumptions compute real $0 figures — not "unavailable"', () => {
    const result = calculateExitPosition(
      baseInput({
        targetDebt: 24000,
        executionCostAssumptions: { swapFeeRate: 0, slippageRate: 0 },
        gasCostUsd: 0,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const entry of result.value.costs) {
      expect(entry.amountUsd).toBe(0);
      expect(entry.reason).toBeUndefined();
    }
  });

  it('gas cost affects only the reported cost items, never repayment/btcSold/remainingDebt/remainingCollateralValue', () => {
    const withoutGas = calculateExitPosition(baseInput({ targetDebt: 24000 }));
    const withGas = calculateExitPosition(baseInput({ targetDebt: 24000, gasCostUsd: 5000 }));
    expect(withoutGas.ok && withGas.ok).toBe(true);
    if (!withoutGas.ok || !withGas.ok) return;
    expect(withGas.value.repayment).toBe(withoutGas.value.repayment);
    expect(withGas.value.btcSold).toBe(withoutGas.value.btcSold);
    expect(withGas.value.remainingDebt).toBe(withoutGas.value.remainingDebt);
    expect(withGas.value.remainingCollateralValue).toBe(withoutGas.value.remainingCollateralValue);
    expect(withGas.value.remainingEquity).toBe(withoutGas.value.remainingEquity);
  });

  it('propagates a validation failure for a negative gas cost', () => {
    const result = calculateExitPosition(baseInput({ targetDebt: 24000, gasCostUsd: -1 }));
    expect(result.ok).toBe(false);
  });
});

describe('calculateExitPosition (M2-023, F-042)', () => {
  it('computes a full-exit result (targetDebt 0) that reconciles with portfolio balances', () => {
    const result = calculateExitPosition(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-042');
    expect(result.value.repayment).toBe(48000);
    expect(result.value.btcSold).toBe(0.8);
    expect(result.value.btcRetained).toBeCloseTo(1.2, 8);
    expect(result.value.remainingDebt).toBe(0);
    expect(result.value.remainingCollateralValue).toBeCloseTo(72000, 6);
    expect(result.value.remainingEquity).toBeCloseTo(72000, 6);
  });

  it('computes a partial-exit result that reconciles with portfolio balances', () => {
    const result = calculateExitPosition(baseInput({ targetDebt: 24000 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.repayment).toBe(24000);
    expect(result.value.btcSold).toBeCloseTo(0.4, 8);
    expect(result.value.btcRetained).toBeCloseTo(1.6, 8);
    expect(result.value.remainingDebt).toBe(24000);
    expect(result.value.remainingCollateralValue).toBeCloseTo(96000, 6);
    expect(result.value.remainingEquity).toBeCloseTo(72000, 6);
  });

  it('omitted execution-cost inputs itemize all 4 cost items as unavailable, with a reason for each (backward compatible)', () => {
    const result = calculateExitPosition(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const items = result.value.costs.map((c) => c.item);
    expect(items).toEqual(['swapFees', 'slippage', 'gasEstimate', 'totalImplementationCost']);
    for (const entry of result.value.costs) {
      expect(entry.amountUsd).toBeNull();
      expect(entry.reason?.length).toBeGreaterThan(0);
    }
  });

  it('supports an optional scenario BTC price override ("Target BTC price")', () => {
    const result = calculateExitPosition(baseInput({ scenarioBtcPriceUsd: 80000 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.btcSold).toBe(0.6); // 48000 / 80000
    expect(result.value.remainingCollateralValue).toBeCloseTo((2 - 0.6) * 80000, 6);
  });

  it('rejects a targetDebt greater than current debt', () => {
    const result = calculateExitPosition(baseInput({ targetDebt: 50000 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_TARGET_DEBT');
  });

  it('rejects an exit that would require selling more BTC than is held', () => {
    const result = calculateExitPosition(baseInput({ scenarioBtcPriceUsd: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INSUFFICIENT_COLLATERAL');
  });

  it('rejects negative targetDebt', () => {
    expect(calculateExitPosition(baseInput({ targetDebt: -1 })).ok).toBe(false);
  });

  it('propagates a failure from invalid debt input', () => {
    const result = calculateExitPosition(
      baseInput({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: -1 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });
});
