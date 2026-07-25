import { describe, expect, it } from 'vitest';

import { calculateLoopStep, type LoopStepInput } from '@/engine/loop/calculateLoopStep';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseInput(overrides: Partial<LoopStepInput> = {}): LoopStepInput {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 60000 },
    protocol,
    borrowPercentage: 0.5,
    ...overrides,
  };
}

describe('calculateLoopStep (M2-015, F-014)', () => {
  it('reconciles a single step against the portfolio and risk modules', () => {
    const result = calculateLoopStep(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-014');
    expect(result.value.availableBorrow).toBe(42000);
    expect(result.value.borrowedAmount).toBe(21000);
    expect(result.value.loopCapital).toBe(21000);
    expect(result.value.btcPurchased).toBe(0.35);
    expect(result.value.collateralAfter).toEqual({ asset: 'BTC', quantity: 1.35 });
    expect(result.value.collateralValueAfter).toBe(81000);
    expect(result.value.debtAfter).toBe(21000);
    expect(result.value.newLoanToValue).toBeCloseTo(0.259259, 6);
    expect(result.value.newHealthFactor).toBeCloseTo(3.085714, 6);
  });

  it('borrows nothing and warns when current debt already exceeds capacity', () => {
    const result = calculateLoopStep(baseInput({ debt: { asset: 'USDC', balance: 50000 } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.borrowedAmount).toBe(0);
    expect(result.value.btcPurchased).toBe(0);
    expect(result.value.debtAfter).toBe(50000);
    expect(result.warnings.some((w) => w.code === 'NO_BORROW_CAPACITY')).toBe(true);
  });

  it('propagates a failure from invalid protocol parameters', () => {
    const result = calculateLoopStep(
      baseInput({ protocol: { ...protocol, maxLoanToValue: 0.9, liquidationThreshold: 0.8 } }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects an out-of-range borrowPercentage', () => {
    const result = calculateLoopStep(baseInput({ borrowPercentage: 1.5 }));
    expect(result.ok).toBe(false);
  });

  it('rejects invalid collateral input', () => {
    const result = calculateLoopStep(baseInput({ collateral: { asset: 'BTC', quantity: -1 } }));
    expect(result.ok).toBe(false);
  });
});
