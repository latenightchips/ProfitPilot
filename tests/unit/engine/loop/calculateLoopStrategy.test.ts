import { describe, expect, it } from 'vitest';

import { calculateLoopStrategy, type LoopStrategyInput } from '@/engine/loop/calculateLoopStrategy';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseInput(overrides: Partial<LoopStrategyInput> = {}): LoopStrategyInput {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 60000 },
    protocol,
    targetBorrowPercentage: 0.5,
    maxLoops: 10,
    minHealthFactor: 1.5,
    ...overrides,
  };
}

/**
 * Loop propagation — V4 Readiness Audit §12 P1-5. A multi-step Loop
 * Builder must use the ALREADY-frictioned collateral from a prior step
 * when computing a subsequent step's own Available Borrow — not just
 * apply friction to the first step in isolation.
 */
describe('calculateLoopStrategy — execution-cost friction propagation (P1-5)', () => {
  it('omitted executionCostAssumptions reproduces the exact pre-P1-5 frictionless result', () => {
    const result = calculateLoopStrategy(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.finalCollateral.quantity).toBeCloseTo(2.11531875, 8);
    expect(result.value.finalDebt).toBeCloseTo(66919.125, 6);
  });

  it('non-zero friction produces strictly less final collateral than the frictionless run, over multiple steps', () => {
    const frictionless = calculateLoopStrategy(baseInput());
    const frictioned = calculateLoopStrategy(
      baseInput({ executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 } }),
    );
    expect(frictionless.ok && frictioned.ok).toBe(true);
    if (!frictionless.ok || !frictioned.ok) return;

    expect(frictioned.value.steps.length).toBeGreaterThan(1);
    expect(frictioned.value.finalCollateral.quantity).toBeLessThan(
      frictionless.value.finalCollateral.quantity,
    );

    // Propagation proof: each step's collateralAfter (and therefore the
    // NEXT step's own Available Borrow, computed from that collateral)
    // is already reduced versus the frictionless run — not just the
    // final total. Compare every step index both runs share.
    const sharedStepCount = Math.min(
      frictionless.value.steps.length,
      frictioned.value.steps.length,
    );
    for (let i = 0; i < sharedStepCount; i += 1) {
      expect(frictioned.value.steps[i]!.collateralAfter.quantity).toBeLessThan(
        frictionless.value.steps[i]!.collateralAfter.quantity,
      );
      expect(frictioned.value.steps[i]!.availableBorrow).toBeLessThanOrEqual(
        frictionless.value.steps[i]!.availableBorrow,
      );
    }
  });

  it('borrowedAmount and debtAfter are unaffected by execution-cost friction — only the BTC-purchase leg is frictioned', () => {
    const frictionless = calculateLoopStrategy(baseInput({ maxLoops: 1 }));
    const frictioned = calculateLoopStrategy(
      baseInput({
        maxLoops: 1,
        executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
      }),
    );
    expect(frictionless.ok && frictioned.ok).toBe(true);
    if (!frictionless.ok || !frictioned.ok) return;
    expect(frictioned.value.steps[0]!.borrowedAmount).toBe(
      frictionless.value.steps[0]!.borrowedAmount,
    );
    expect(frictioned.value.finalDebt).toBe(frictionless.value.finalDebt);
  });
});

describe('calculateLoopStrategy (M2-016, F-018)', () => {
  it('stops safely at the configured minimum Health Factor before breaching it', () => {
    const result = calculateLoopStrategy(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-018');
    expect(result.value.stopReason).toBe('MIN_HEALTH_FACTOR_REACHED');
    expect(result.value.steps).toHaveLength(4);
    expect(result.value.steps.map((s) => s.stepNumber)).toEqual([1, 2, 3, 4]);
    expect(result.value.finalCollateral.quantity).toBeCloseTo(2.11531875, 8);
    expect(result.value.finalDebt).toBeCloseTo(66919.125, 6);
    expect(result.value.finalEquity).toBeCloseTo(60000, 6);
    expect(result.value.finalLeverage).toBeCloseTo(2.11531875, 6);
    expect(result.value.finalHealthFactor).toBeCloseTo(1.517284, 6);

    // Every committed step's ending Health Factor must remain above the floor.
    for (const step of result.value.steps) {
      expect(step.newHealthFactor).toBeGreaterThan(1.5);
    }
  });

  it('stops at the configured maximum loop count when the floor is never reached', () => {
    const result = calculateLoopStrategy(baseInput({ maxLoops: 2, minHealthFactor: 0.01 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.stopReason).toBe('MAX_LOOPS_REACHED');
    expect(result.value.steps).toHaveLength(2);
    expect(result.value.finalCollateral.quantity).toBeCloseTo(1.6475, 6);
    expect(result.value.finalDebt).toBeCloseTo(38850, 6);
  });

  it('stops with no committed steps when starting debt already exhausts borrow capacity', () => {
    const result = calculateLoopStrategy(
      baseInput({ debt: { asset: 'USDC', balance: 42000 }, minHealthFactor: 0.01 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.stopReason).toBe('NO_AVAILABLE_BORROW');
    expect(result.value.steps).toHaveLength(0);
    expect(result.value.finalCollateral).toEqual({ asset: 'BTC', quantity: 1 });
    expect(result.value.finalDebt).toBe(42000);
  });

  it('takes zero steps and reaches MAX_LOOPS_REACHED when maxLoops is 0', () => {
    const result = calculateLoopStrategy(baseInput({ maxLoops: 0 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.stopReason).toBe('MAX_LOOPS_REACHED');
    expect(result.value.steps).toHaveLength(0);
  });

  it('rejects a non-integer maxLoops', () => {
    expect(calculateLoopStrategy(baseInput({ maxLoops: 2.5 })).ok).toBe(false);
  });

  it('rejects a negative maxLoops', () => {
    expect(calculateLoopStrategy(baseInput({ maxLoops: -1 })).ok).toBe(false);
  });

  it('rejects a non-positive minHealthFactor', () => {
    expect(calculateLoopStrategy(baseInput({ minHealthFactor: 0 })).ok).toBe(false);
  });

  it('rejects an out-of-range targetBorrowPercentage', () => {
    expect(calculateLoopStrategy(baseInput({ targetBorrowPercentage: 1.5 })).ok).toBe(false);
  });

  it('propagates a failure from invalid protocol parameters', () => {
    const result = calculateLoopStrategy(
      baseInput({ protocol: { ...protocol, maxLoanToValue: 0.9, liquidationThreshold: 0.8 } }),
    );
    expect(result.ok).toBe(false);
  });
});
