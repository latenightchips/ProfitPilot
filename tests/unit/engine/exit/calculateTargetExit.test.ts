import { describe, expect, it } from 'vitest';

import { calculateTargetExit, type TargetExitParams } from '@/engine/exit/calculateTargetExit';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseParams(overrides: Partial<TargetExitParams> = {}): TargetExitParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 60000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    target: { type: 'debtBalance', targetDebt: 48000 },
    ...overrides,
  };
}

describe('calculateTargetExit (M2-024, F-040)', () => {
  it('resolves a debtBalance target directly and computes the exit', () => {
    const result = calculateTargetExit(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-040');
    expect(result.value.feasible).toBe(true);
    expect(result.value.resolvedTargetDebt).toBe(48000);
    expect(result.value.exit?.repayment).toBe(12000);
    expect(result.value.exit?.btcSold).toBeCloseTo(0.2, 8);
  });

  it('resolves a healthFactor target via F-040 to the same result as an equivalent debtBalance target', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'healthFactor', targetHealthFactor: 2.0 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(true);
    expect(result.value.resolvedTargetDebt).toBe(48000);
    expect(result.value.exit?.repayment).toBe(12000);
  });

  it('resolves a retainedBtc target to the same result as an equivalent debtBalance target', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'retainedBtc', targetRetainedBtc: 1.8 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(true);
    expect(result.value.resolvedTargetDebt).toBe(48000);
    expect(result.value.exit?.btcRetained).toBeCloseTo(1.8, 8);
  });

  it('reports infeasible when the retained BTC target exceeds current holdings', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'retainedBtc', targetRetainedBtc: 3 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(false);
    expect(result.value.exit).toBeNull();
    expect(result.value.infeasibleReason).toMatch(/exceeds the portfolio’s current holdings/);
  });

  it('reports infeasible when a health factor target would require more debt than currently held', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'healthFactor', targetHealthFactor: 0.5 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(false);
    expect(result.value.infeasibleReason).toMatch(/more debt/);
  });

  it('reports infeasible for a negative debtBalance target', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'debtBalance', targetDebt: -100 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(false);
    expect(result.value.infeasibleReason).toMatch(/cannot be negative/);
  });

  it('reports infeasible when a retainedBtc target would generate more cash than needed to fully repay debt', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'retainedBtc', targetRetainedBtc: 0 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(false);
    expect(result.value.infeasibleReason).toMatch(/more cash than needed/);
  });

  it('applies an optional scenario BTC price to the resolved exit', () => {
    const result = calculateTargetExit(baseParams({ scenarioBtcPriceUsd: 80000 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.exit?.btcSold).toBe(0.15); // 12000 / 80000
  });

  it('propagates a failure from a non-positive healthFactor target', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'healthFactor', targetHealthFactor: 0 } }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from a negative retainedBtc target', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'retainedBtc', targetRetainedBtc: -1 } }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from invalid portfolio input', () => {
    const result = calculateTargetExit(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: -1 },
          debt: { asset: 'USDC', balance: 60000 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });
});
