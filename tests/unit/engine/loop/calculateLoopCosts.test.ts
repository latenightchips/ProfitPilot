import { describe, expect, it } from 'vitest';

import { calculateLoopCosts, type LoopExecutionCostInputs } from '@/engine/loop/calculateLoopCosts';

describe('calculateLoopCosts (M2-017, partial, F-037)', () => {
  it('computes borrowing interest (F-032) and break-even appreciation (F-037)', () => {
    const result = calculateLoopCosts(50000, 0.05, 150000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-037');
    expect(result.value.borrowingInterest).toBe(2500);
    expect(result.value.breakEvenAppreciation).toBeCloseTo(0.016667, 6);
  });

  it('omitted execution inputs itemize all 4 cost items as unavailable, with a reason for each (backward compatible)', () => {
    const result = calculateLoopCosts(50000, 0.05, 150000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const items = result.value.items.map((entry) => entry.item);
    expect(items).toEqual(['swapFees', 'slippage', 'gasEstimate', 'totalImplementationCost']);
    for (const entry of result.value.items) {
      expect(entry.amountUsd).toBeNull();
      expect(entry.reason?.length).toBeGreaterThan(0);
    }
  });

  it('propagates a failure from an invalid borrow APR', () => {
    expect(calculateLoopCosts(50000, -0.01, 150000).ok).toBe(false);
  });

  it('propagates a failure from zero exposure', () => {
    expect(calculateLoopCosts(50000, 0.05, 0).ok).toBe(false);
  });
});

/**
 * Execution-cost reporting — V4 Readiness Audit §12 P1-6. Composes
 * F-072/F-073 (already-approved P1-5 primitives) to turn the pre-P1-6
 * always-unavailable itemization into real computed dollar figures, once
 * the product layer supplies what each item needs.
 */
describe('calculateLoopCosts — execution-cost reporting (P1-6)', () => {
  it('computes real swapFees/slippage/gasEstimate/totalImplementationCost matching F-073, given full execution inputs', () => {
    const execution: LoopExecutionCostInputs = {
      totalBorrowedUsd: 25000,
      transactionCount: 3,
      assumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
      gasCostPerTransactionUsd: 15,
    };
    const result = calculateLoopCosts(50000, 0.05, 150000, execution);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // F-073: swapFeeCost = notional x feeRate; slippageCost = notional x
    // (1-feeRate) x slippageRate; matches calculateTotalExecutionCost's
    // own worked math exactly (25000 x 0.003 = 75; 25000 x 0.997 x 0.005
    // = 124.625).
    const byItem = Object.fromEntries(result.value.items.map((entry) => [entry.item, entry]));
    expect(byItem.swapFees!.amountUsd).toBeCloseTo(75, 6);
    expect(byItem.slippage!.amountUsd).toBeCloseTo(124.625, 6);
    // F-072: 3 transactions x $15 = $45.
    expect(byItem.gasEstimate!.amountUsd).toBeCloseTo(45, 6);
    // Total = 75 + 124.625 + 45.
    expect(byItem.totalImplementationCost!.amountUsd).toBeCloseTo(244.625, 6);
    for (const entry of result.value.items) {
      expect(entry.reason).toBeUndefined();
    }
  });

  it('gas configured alone computes a real gasEstimate while swapFees/slippage/total stay unavailable', () => {
    const execution: LoopExecutionCostInputs = {
      totalBorrowedUsd: 25000,
      transactionCount: 2,
      gasCostPerTransactionUsd: 10,
    };
    const result = calculateLoopCosts(50000, 0.05, 150000, execution);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byItem = Object.fromEntries(result.value.items.map((entry) => [entry.item, entry]));
    expect(byItem.gasEstimate!.amountUsd).toBe(20);
    expect(byItem.swapFees!.amountUsd).toBeNull();
    expect(byItem.slippage!.amountUsd).toBeNull();
    expect(byItem.totalImplementationCost!.amountUsd).toBeNull();
  });

  it('swap fee/slippage configured alone computes real figures while gasEstimate/total stay unavailable', () => {
    const execution: LoopExecutionCostInputs = {
      totalBorrowedUsd: 10000,
      transactionCount: 1,
      assumptions: { swapFeeRate: 0.01, slippageRate: 0.02 },
    };
    const result = calculateLoopCosts(50000, 0.05, 150000, execution);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byItem = Object.fromEntries(result.value.items.map((entry) => [entry.item, entry]));
    expect(byItem.swapFees!.amountUsd).toBeCloseTo(100, 6);
    expect(byItem.slippage!.amountUsd).toBeCloseTo(198, 6);
    expect(byItem.gasEstimate!.amountUsd).toBeNull();
    expect(byItem.totalImplementationCost!.amountUsd).toBeNull();
  });

  it('explicit zero assumptions compute real $0 figures — not "unavailable" — proving 0 is distinct from unconfigured', () => {
    const execution: LoopExecutionCostInputs = {
      totalBorrowedUsd: 25000,
      transactionCount: 3,
      assumptions: { swapFeeRate: 0, slippageRate: 0 },
      gasCostPerTransactionUsd: 0,
    };
    const result = calculateLoopCosts(50000, 0.05, 150000, execution);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const entry of result.value.items) {
      expect(entry.amountUsd).toBe(0);
      expect(entry.reason).toBeUndefined();
    }
  });

  it('no-double-count: swapFees + slippage equals notional x (1 - effectiveRate), the same friction F-070 already applied once', () => {
    const notionalUsd = 40000;
    const swapFeeRate = 0.003;
    const slippageRate = 0.005;
    const execution: LoopExecutionCostInputs = {
      totalBorrowedUsd: notionalUsd,
      transactionCount: 1,
      assumptions: { swapFeeRate, slippageRate },
    };
    const result = calculateLoopCosts(50000, 0.05, 150000, execution);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const byItem = Object.fromEntries(result.value.items.map((entry) => [entry.item, entry]));
    const effectiveRate = (1 - swapFeeRate) * (1 - slippageRate);
    const expectedFrictionCost = notionalUsd * (1 - effectiveRate);
    expect(byItem.swapFees!.amountUsd! + byItem.slippage!.amountUsd!).toBeCloseTo(
      expectedFrictionCost,
      6,
    );
  });

  it('gas cost affects only the reported cost items, never borrowingInterest/breakEvenAppreciation', () => {
    const withoutGas = calculateLoopCosts(50000, 0.05, 150000);
    const withGas = calculateLoopCosts(50000, 0.05, 150000, {
      totalBorrowedUsd: 25000,
      transactionCount: 5,
      gasCostPerTransactionUsd: 1000,
    });
    expect(withoutGas.ok && withGas.ok).toBe(true);
    if (!withoutGas.ok || !withGas.ok) return;
    expect(withGas.value.borrowingInterest).toBe(withoutGas.value.borrowingInterest);
    expect(withGas.value.breakEvenAppreciation).toBe(withoutGas.value.breakEvenAppreciation);
  });

  it('propagates a validation failure for an invalid execution-cost rate', () => {
    const result = calculateLoopCosts(50000, 0.05, 150000, {
      totalBorrowedUsd: 25000,
      transactionCount: 1,
      assumptions: { swapFeeRate: -0.1, slippageRate: 0 },
    });
    expect(result.ok).toBe(false);
  });

  it('propagates a validation failure for a negative gas cost', () => {
    const result = calculateLoopCosts(50000, 0.05, 150000, {
      totalBorrowedUsd: 25000,
      transactionCount: 1,
      gasCostPerTransactionUsd: -5,
    });
    expect(result.ok).toBe(false);
  });

  it('never leaks NaN or Infinity even at rates approaching the domain boundary', () => {
    const result = calculateLoopCosts(50000, 0.05, 150000, {
      totalBorrowedUsd: 25000,
      transactionCount: 1,
      assumptions: { swapFeeRate: 0.999999, slippageRate: 0.999999 },
      gasCostPerTransactionUsd: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const entry of result.value.items) {
      if (entry.amountUsd !== null) {
        expect(Number.isFinite(entry.amountUsd)).toBe(true);
      }
    }
  });
});
