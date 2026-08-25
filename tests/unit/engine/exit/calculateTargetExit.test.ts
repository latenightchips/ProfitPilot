import { describe, expect, it } from 'vitest';

import { calculateExitPosition } from '@/engine/exit/calculateExitPosition';
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

/**
 * Exit propagation — V4 Readiness Audit §12 P1-5. Different `ExitTarget`
 * types that resolve to the SAME `targetDebt` must produce IDENTICAL
 * frictioned BTC-sale figures — proving they share the one
 * `calculateExitPosition` ownership boundary rather than each
 * independently reimplementing F-071's friction math.
 */
describe('calculateTargetExit — execution-cost friction propagation (P1-5)', () => {
  const assumptions = { swapFeeRate: 0.003, slippageRate: 0.005 };

  it('a debtBalance target and an equivalent retainedBtc target (both resolving to targetDebt=48000) produce the identical frictioned exit', () => {
    const byDebtBalance = calculateTargetExit(
      baseParams({
        target: { type: 'debtBalance', targetDebt: 48000 },
        executionCostAssumptions: assumptions,
      }),
    );
    // targetRetainedBtc = 1.8 resolves to the identical targetDebt=48000
    // via the SAME frictionless closed-form solve (unaffected by P1-5) —
    // collateral 2 BTC - 1.8 retained = 0.2 BTC sold = $12,000 repayment,
    // debt 60000 - 12000 = 48000.
    const byRetainedBtc = calculateTargetExit(
      baseParams({
        target: { type: 'retainedBtc', targetRetainedBtc: 1.8 },
        executionCostAssumptions: assumptions,
      }),
    );

    expect(byDebtBalance.ok && byRetainedBtc.ok).toBe(true);
    if (!byDebtBalance.ok || !byRetainedBtc.ok) return;

    expect(byDebtBalance.value.resolvedTargetDebt).toBe(48000);
    expect(byRetainedBtc.value.resolvedTargetDebt).toBe(48000);
    expect(byDebtBalance.value.exit?.btcSold).toBe(byRetainedBtc.value.exit?.btcSold);
    expect(byDebtBalance.value.exit?.btcRetained).toBe(byRetainedBtc.value.exit?.btcRetained);
    // And the frictioned figure genuinely differs from the frictionless one.
    expect(byDebtBalance.value.exit?.btcSold).toBeGreaterThan(0.2);
  });

  it('omitted executionCostAssumptions reproduces the exact pre-P1-5 frictionless result', () => {
    const result = calculateTargetExit(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.exit?.btcSold).toBeCloseTo(0.2, 8);
  });
});

/**
 * Friction-aware healthFactor target resolution — V4 Readiness Audit §12
 * P1-5 correction. Before this fix, `resolveTargetDebt`'s `healthFactor`
 * branch always solved the frictionless closed form regardless of
 * `executionCostAssumptions`, while `calculateExitPosition` downstream DID
 * apply friction — an internally inconsistent Engine API. The corrected
 * closed form solves R = E x (H x D0 - LT x collateralValue0) /
 * (E x H - LT), which reduces exactly to the pre-fix formula at E = 1.
 */
describe('calculateTargetExit — friction-aware healthFactor target resolution (P1-5 correction)', () => {
  it('omitted executionCostAssumptions reproduces the exact pre-fix healthFactor-target result', () => {
    const result = calculateTargetExit(
      baseParams({ target: { type: 'healthFactor', targetHealthFactor: 2.0 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feasible).toBe(true);
    expect(result.value.resolvedTargetDebt).toBe(40000);
    expect(result.value.exit?.repayment).toBe(20000);
  });

  it('explicit zero rates reproduce the exact pre-fix healthFactor-target result', () => {
    const result = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 2.0 },
        executionCostAssumptions: { swapFeeRate: 0, slippageRate: 0 },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feasible).toBe(true);
    expect(result.value.resolvedTargetDebt).toBe(40000);
    expect(result.value.exit?.repayment).toBe(20000);
  });

  it('non-zero fee/slippage resolve a friction-aware repayment that actually reaches the target HF, within the M2-027 tolerance', () => {
    const result = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 2.0 },
        executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.feasible).toBe(true);
    if (!result.value.resolvedTargetDebt || !result.value.exit) return;

    // Independently derived expected values (see this suite's own header
    // comment and the corrected P1-5 report for the full derivation).
    expect(result.value.resolvedTargetDebt).toBeCloseTo(39892.097329, 5);
    expect(result.value.exit.repayment).toBeCloseTo(20107.902671, 5);

    // The resolved exit must reproduce the requested target HF exactly
    // (within floating-point rounding) — this is the whole point of the
    // fix: the target resolution and the actual frictioned sale now agree.
    const resultingHf =
      (result.value.exit.remainingCollateralValue * 0.8) / result.value.exit.remainingDebt;
    expect(resultingHf).toBeCloseTo(2.0, 9);
  });

  it('proves the pre-fix inconsistency: the old frictionless resolvedTargetDebt (40000), replayed through the actual frictioned calculateExitPosition, does NOT reach the target HF', () => {
    // This replays exactly what the pre-fix `resolveTargetDebt` would have
    // handed to `calculateExitPosition` for this same target/assumptions —
    // the frictionless resolvedTargetDebt of 40000 — and shows it misses
    // the requested target Health Factor of 2.0 by far more than the
    // M2-027 tolerance (1e-9), which is exactly the "internally
    // inconsistent Engine API" this correction fixes.
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 60000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const preFixExit = calculateExitPosition({
      portfolio,
      targetDebt: 40000,
      executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
    });
    expect(preFixExit.ok).toBe(true);
    if (!preFixExit.ok) return;

    const preFixResultingHf =
      (preFixExit.value.remainingCollateralValue * 0.8) / preFixExit.value.remainingDebt;
    expect(preFixResultingHf).not.toBeCloseTo(2.0, 3);
    expect(Math.abs(preFixResultingHf - 2.0)).toBeGreaterThan(1e-9);

    // The corrected resolution, by contrast, reaches the target.
    const corrected = calculateTargetExit(
      baseParams({
        portfolio,
        target: { type: 'healthFactor', targetHealthFactor: 2.0 },
        executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
      }),
    );
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;
    expect(corrected.value.feasible).toBe(true);
    expect(corrected.value.resolvedTargetDebt).not.toBe(40000);
  });

  it('higher execution friction requires a lower resolvedTargetDebt (strictly more repayment) to reach the identical target HF', () => {
    const lowFriction = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 2.0 },
        executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
      }),
    );
    const highFriction = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 2.0 },
        executionCostAssumptions: { swapFeeRate: 0.01, slippageRate: 0.02 },
      }),
    );
    expect(lowFriction.ok && highFriction.ok).toBe(true);
    if (!lowFriction.ok || !highFriction.ok) return;
    expect(lowFriction.value.feasible && highFriction.value.feasible).toBe(true);
    if (!lowFriction.value.resolvedTargetDebt || !highFriction.value.resolvedTargetDebt) return;

    expect(highFriction.value.resolvedTargetDebt).toBeLessThan(
      lowFriction.value.resolvedTargetDebt,
    );
    expect(highFriction.value.exit?.repayment).toBeGreaterThan(lowFriction.value.exit!.repayment);
    expect(highFriction.value.exit?.btcSold).toBeGreaterThan(lowFriction.value.exit!.btcSold);
  });

  it('other target types (debtBalance, retainedBtc) are unaffected by this fix beyond their already-intended F-071 execution effect', () => {
    const byDebtBalance = calculateTargetExit(
      baseParams({
        target: { type: 'debtBalance', targetDebt: 48000 },
        executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
      }),
    );
    expect(byDebtBalance.ok).toBe(true);
    if (!byDebtBalance.ok) return;
    // Unchanged: debtBalance resolution never depended on friction.
    expect(byDebtBalance.value.resolvedTargetDebt).toBe(48000);
  });

  it('target HF already satisfied (would require adding debt) remains infeasible under friction, same as frictionless', () => {
    const result = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 1.0 },
        executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feasible).toBe(false);
    expect(result.value.infeasibleReason).toMatch(/more debt/);
  });

  it('a very high target HF (repayment approaching full debt) resolves feasibly under friction, without ever reaching or exceeding full debt', () => {
    const result = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 100 },
        executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feasible).toBe(true);
    if (!result.value.resolvedTargetDebt || !result.value.exit) return;
    expect(result.value.resolvedTargetDebt).toBeGreaterThan(0);
    expect(result.value.exit.repayment).toBeLessThan(60000);
    expect(Number.isFinite(result.value.resolvedTargetDebt)).toBe(true);
  });

  it('zero debt: a healthFactor target remains explicitly infeasible (not NaN/Infinity) under friction', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const result = calculateTargetExit({
      portfolio,
      target: { type: 'healthFactor', targetHealthFactor: 2.0 },
      executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feasible).toBe(false);
    expect(result.value.infeasibleReason).toMatch(/more debt/);
  });

  it('reports infeasible (never NaN/Infinity) when execution friction drives the denominator to exactly zero, even though the target exceeds the liquidation threshold', () => {
    // fee=0, slippage=0.5 -> E=0.5; target HF 1.6; E x 1.6 - 0.8 = 0 exactly.
    const result = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 1.6 },
        executionCostAssumptions: { swapFeeRate: 0, slippageRate: 0.5 },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feasible).toBe(false);
    expect(result.value.resolvedTargetDebt).toBeNull();
    expect(result.value.infeasibleReason).toMatch(/execution-cost assumptions/);
  });

  it('reports infeasible when severe friction makes an above-threshold target unreachable', () => {
    const result = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 0.85 },
        executionCostAssumptions: { swapFeeRate: 0.3, slippageRate: 0.3 },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feasible).toBe(false);
    expect(result.value.infeasibleReason).toMatch(/execution-cost assumptions/);
  });

  it('never leaks NaN or Infinity even at execution-cost rates approaching the domain boundary', () => {
    const result = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 2.0 },
        executionCostAssumptions: { swapFeeRate: 0.999999, slippageRate: 0.999999 },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.feasible).toBe(false);
    expect(result.value.resolvedTargetDebt).toBeNull();
    expect(Number.isNaN(result.value.resolvedTargetDebt)).toBe(false);
  });

  it('propagates a validation failure (not a silent infeasible) for invalid execution-cost assumptions on a healthFactor target', () => {
    const result = calculateTargetExit(
      baseParams({
        target: { type: 'healthFactor', targetHealthFactor: 2.0 },
        executionCostAssumptions: { swapFeeRate: -0.1, slippageRate: 0 },
      }),
    );
    expect(result.ok).toBe(false);
  });
});

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
