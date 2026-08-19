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

  it('resolves a healthFactor target via the self-financed closed-form solve (Conflict #13 fix)', () => {
    // 2 BTC @ $60,000 = $120,000 collateral, $60,000 debt, LT 0.8, target
    // HF 2.0. The self-financed solve (debt1 = LT x (collateralValue0 -
    // debt0) / (targetHF - LT)) gives debt1 = 0.8 x 60000 / 1.2 = 40000 —
    // not the fixed-collateral F-040 value of 48000, which would leave the
    // resulting HF at 1.8 instead of the requested 2.0 (see the M2-027
    // invariant suite for the reproduce-the-target check).
    const result = calculateTargetExit(
      baseParams({ target: { type: 'healthFactor', targetHealthFactor: 2.0 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(true);
    expect(result.value.resolvedTargetDebt).toBe(40000);
    expect(result.value.exit?.repayment).toBe(20000);
    expect(result.value.exit?.remainingDebt).toBe(40000);
    expect(result.value.exit?.remainingCollateralValue).toBe(100000);
  });

  it('resolves a self-financed healthFactor target reproducing the user-reported bug scenario', () => {
    // 2 BTC @ $67,193.47, $30,500 debt, collateral factor 0.75, target HF
    // 4 — the exact scenario from the bug report. The buggy fixed-
    // collateral formula returned a resulting HF of 3.84; the self-financed
    // solve must reproduce ~4.0 within the M2-027 invariant tolerance.
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 30500 },
      market: { btcPriceUsd: 67193.47 },
      protocol: {
        maxLoanToValue: 0.7,
        liquidationThreshold: 0.75,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = calculateTargetExit({
      portfolio,
      target: { type: 'healthFactor', targetHealthFactor: 4 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(true);
    if (!result.value.exit) return;

    const resultingHf =
      (result.value.exit.remainingCollateralValue * 0.75) / result.value.exit.remainingDebt;
    expect(resultingHf).toBeCloseTo(4, 6);
  });

  it('reports infeasible (not a hard failure) when a healthFactor target is positive but at or below the liquidation threshold', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'healthFactor', targetHealthFactor: 0.8 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(false);
    expect(result.value.exit).toBeNull();
    expect(result.value.infeasibleReason).toMatch(/liquidation threshold/);
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
    // Base portfolio's current HF is 1.6 (120000 x 0.8 / 60000); a target
    // of 1.0 sits strictly between the liquidation threshold (0.8) and the
    // current HF, so it is mathematically resolvable but only by adding
    // debt, not repaying it.
    const result = calculateTargetExit(
      baseParams({ target: { type: 'healthFactor', targetHealthFactor: 1.0 } }),
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
