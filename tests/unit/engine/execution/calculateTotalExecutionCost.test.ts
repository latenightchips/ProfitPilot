import { describe, expect, it } from 'vitest';

import { calculateTotalExecutionCost } from '@/engine/execution/calculateTotalExecutionCost';
import { calculateBtcPurchasedPerLoop } from '@/engine/loop/calculateBtcPurchasedPerLoop';

describe('calculateTotalExecutionCost (F-073)', () => {
  it('matches the documented Loop-context example: notional $30,000 @ 0.3%/0.5% + $60.00 gas -> $299.55 total', () => {
    const result = calculateTotalExecutionCost(
      30000,
      { swapFeeRate: 0.003, slippageRate: 0.005 },
      60,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.formulaId).toBe('F-073');
    expect(result.value.swapFeeCostUsd).toBeCloseTo(90, 8);
    expect(result.value.slippageCostUsd).toBeCloseTo(149.55, 8);
    expect(result.value.totalGasCostUsd).toBe(60);
    expect(result.value.totalExecutionCostUsd).toBeCloseTo(299.55, 8);
  });

  it('zero rates produce zero swap-fee/slippage cost, leaving only gas', () => {
    const result = calculateTotalExecutionCost(30000, { swapFeeRate: 0, slippageRate: 0 }, 60);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.swapFeeCostUsd).toBe(0);
    expect(result.value.slippageCostUsd).toBe(0);
    expect(result.value.totalExecutionCostUsd).toBe(60);
  });
});

/**
 * No-double-count invariant — 02_Formulas.md F-073's own "Identity
 * Proof": swapFeeCostUsd + slippageCostUsd must equal exactly the
 * friction F-070 already applied once (notional - effectiveNotional),
 * proven here against the REAL F-070 implementation, not a hand
 * re-derivation of the same arithmetic.
 */
describe('calculateTotalExecutionCost — no-double-count invariant against real F-070 (P1-5)', () => {
  it('swapFeeCostUsd + slippageCostUsd exactly equals borrowAmount - F-070 effectiveNotional', () => {
    const borrowAmount = 30000;
    const assumptions = { swapFeeRate: 0.003, slippageRate: 0.005 };

    const btcPurchased = calculateBtcPurchasedPerLoop(borrowAmount, 60000, assumptions);
    expect(btcPurchased.ok).toBe(true);
    if (!btcPurchased.ok) return;
    const effectiveNotional = btcPurchased.value * 60000;

    const costResult = calculateTotalExecutionCost(borrowAmount, assumptions, 0);
    expect(costResult.ok).toBe(true);
    if (!costResult.ok) return;

    const impliedFriction = costResult.value.swapFeeCostUsd + costResult.value.slippageCostUsd;
    expect(impliedFriction).toBeCloseTo(borrowAmount - effectiveNotional, 6);
  });

  it('F-073 adds gas exactly once — total equals (swapFeeCost + slippageCost) + gas, not double-applied', () => {
    const result = calculateTotalExecutionCost(
      30000,
      { swapFeeRate: 0.003, slippageRate: 0.005 },
      60,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalExecutionCostUsd).toBeCloseTo(
      result.value.swapFeeCostUsd + result.value.slippageCostUsd + result.value.totalGasCostUsd,
      10,
    );
  });
});

describe('calculateTotalExecutionCost — invalid domains (P1-5)', () => {
  it('rejects a negative notionalUsd', () => {
    expect(calculateTotalExecutionCost(-1, { swapFeeRate: 0, slippageRate: 0 }, 0).ok).toBe(false);
  });

  it('rejects swapFeeRate >= 1', () => {
    expect(calculateTotalExecutionCost(30000, { swapFeeRate: 1, slippageRate: 0 }, 0).ok).toBe(
      false,
    );
  });

  it('rejects slippageRate >= 1', () => {
    expect(calculateTotalExecutionCost(30000, { swapFeeRate: 0, slippageRate: 1 }, 0).ok).toBe(
      false,
    );
  });

  it('rejects a negative totalGasCostUsd', () => {
    expect(calculateTotalExecutionCost(30000, { swapFeeRate: 0, slippageRate: 0 }, -1).ok).toBe(
      false,
    );
  });
});

/**
 * Gas isolation — changing the gas input must never change the
 * swap-fee/slippage line items, and vice versa.
 */
describe('calculateTotalExecutionCost — gas isolation (P1-5)', () => {
  it('changing totalGasCostUsd does not change swapFeeCostUsd or slippageCostUsd', () => {
    const assumptions = { swapFeeRate: 0.003, slippageRate: 0.005 };
    const lowGas = calculateTotalExecutionCost(30000, assumptions, 10);
    const highGas = calculateTotalExecutionCost(30000, assumptions, 10000);
    expect(lowGas.ok && highGas.ok).toBe(true);
    if (!lowGas.ok || !highGas.ok) return;
    expect(lowGas.value.swapFeeCostUsd).toBe(highGas.value.swapFeeCostUsd);
    expect(lowGas.value.slippageCostUsd).toBe(highGas.value.slippageCostUsd);
    expect(highGas.value.totalExecutionCostUsd).not.toBe(lowGas.value.totalExecutionCostUsd);
  });
});
