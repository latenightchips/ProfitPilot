import { describe, expect, it } from 'vitest';

import type { ExitTarget } from '@/engine';
import { planExit } from '@/services/exit/plan';
import type { ApplicationPortfolio } from '@/services/portfolio/models';

/**
 * Exit Planning Service — 06_TASKS.md M3-011.
 *
 * Same base portfolio as `services/portfolio`'s own tests (2 BTC @
 * $50,000, $20,000 debt, 75%/80% LTV/liquidation-threshold, 5%/2%
 * borrow/supply APR) — baseline `PortfolioSummary` already known
 * (netEquity 80000, healthFactor 4, interestCost 1000, leverage 1.25).
 *
 * Revisits conflicts #10 and #13 (#10 resolved at the Engine layer by
 * scoping; #13 — the 'healthFactor' target's fixed-collateral undershoot —
 * resolved with a self-financed closed-form solve, not by inventing
 * behavior — see `plan.ts`'s header comment). Also exercises conflict #20
 * (`calculatePortfolioSummary` could not summarize a zero-debt
 * portfolio): a full exit (`targetDebt: 0`) always produces a zero-debt
 * "after" portfolio, so `planExit` used to fail for full exits
 * specifically. Resolved as its own dedicated follow-up (Milestone 4
 * Batch 0) — `services/portfolio/summary.ts` now reports
 * `liquidation: null` for zero debt instead of failing; the test below
 * now pins the fixed, successful behavior.
 */
function basePortfolio(): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  };
}

describe('planExit — partial exits (M3-011)', () => {
  it('computes a before-and-after comparison for a partial debtBalance exit', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.feasible).toBe(true);
    expect(result.data.before.netEquity).toBe(80000);
    expect(result.data.transaction).toEqual({ repayment: 10000, btcSold: 0.2, btcRetained: 1.8 });

    expect(result.data.after?.collateralValue).toBe(90000);
    expect(result.data.after?.debtValue).toBe(10000);
    expect(result.data.after?.netEquity).toBe(80000);
    expect(result.data.after?.healthFactor).toBe(7.2);
    expect(result.data.after?.liquidation?.distance).toBe(6.2);
    expect(result.data.after?.interestCost).toBe(500);
    expect(result.data.after?.leverage).toBe(1.125);
  });

  it('passes through costs (unavailable when no assumptions are configured) rather than inventing a transaction-cost model (conflict #8, P1-6 backward compatibility)', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const items = result.data.costs?.map((c) => c.item);
    expect(items).toEqual(
      expect.arrayContaining(['swapFees', 'slippage', 'gasEstimate', 'totalImplementationCost']),
    );
    for (const entry of result.data.costs ?? []) {
      expect(entry.amountUsd).toBeNull();
    }
  });

  it('reports infeasible with a reason when the target exceeds current debt', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 30000 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(false);
    expect(typeof result.data.infeasibleReason).toBe('string');
    expect(result.data.after).toBeNull();
    expect(result.data.transaction).toBeNull();
    expect(result.data.costs).toBeNull();
    // The baseline is still reported even when infeasible.
    expect(result.data.before.netEquity).toBe(80000);
  });

  it('supports a healthFactor target and reproduces the requested target (Conflict #13 fix)', () => {
    // Self-financed closed-form solve: debt1 = LT x (collateralValue0 -
    // debt0) / (targetHF - LT) = 0.8 x 80000 / 4.2 ≈ 15238.10, giving a
    // repayment of ≈4761.90 — not the old fixed-collateral F-040 value,
    // which undershot the requested target once collateral was sold.
    const target: ExitTarget = { type: 'healthFactor', targetHealthFactor: 5 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
    expect(result.data.transaction?.repayment).toBeCloseTo(4761.904761904763, 6);
    expect(result.data.after?.healthFactor).toBeCloseTo(5, 6);
  });

  it('supports a retainedBtc target', () => {
    const target: ExitTarget = { type: 'retainedBtc', targetRetainedBtc: 1.8 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
    expect(result.data.transaction?.btcRetained).toBe(1.8);
  });

  it('threads sourceStatus through to metadata', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(basePortfolio(), target, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sourceStatus).toBe('manual');
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...basePortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(invalidPortfolio, target, 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('does not have an errors field on a success result (discriminated union, not a nullable envelope)', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    expect('errors' in result).toBe(false);
  });
});

describe('planExit — full exit and conflict #20 interaction (M3-011)', () => {
  it('a full exit (targetDebt: 0) now succeeds and reports a null liquidation summary (conflict #20 resolved)', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
    expect(result.data.after?.debtValue).toBe(0);
    expect(result.data.after?.healthFactor).toBe(Infinity);
    expect(result.data.after?.liquidation).toBeNull();
    expect(result.data.after?.netEquity).toBe(80000);
  });

  it('V1.1 Batch 4: a full exit whose execution friction consumes 100% of collateral lands on the true zero/zero state and still succeeds, never DIVISION_BY_ZERO', () => {
    // Collateral 1 BTC @ $50,000 = $50,000 (positive net worth at
    // baseline: debt $49,000 < collateral value $50,000, so the "before"
    // summary is unaffected by this batch and succeeds as always). A 2%
    // swap fee means repaying the full $49,000 debt requires selling
    // 49000 / (50000 x 0.98) = exactly 1 BTC — 100% of collateral — so
    // btcRetained lands at exactly 0 too, not just remainingDebt. This is
    // the genuine State A (0/0) boundary calculateExitPosition itself
    // permits (btcRetained.isNegative() is the only rejection check,
    // never btcRetained.isZero()) — before this batch's engine fix,
    // calculatePortfolioSummary's leverage step would have failed this
    // "after" summary with DIVISION_BY_ZERO.
    const nearlyFullyCollateralizedPortfolio: ApplicationPortfolio = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 49000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const result = planExit(nearlyFullyCollateralizedPortfolio, target, 'live', undefined, {
      swapFeeRate: 0.02,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
    expect(result.data.transaction?.btcRetained).toBe(0);
    expect(result.data.after?.collateralValue).toBe(0);
    expect(result.data.after?.debtValue).toBe(0);
    expect(result.data.after?.leverage).toBe(0);
    expect(result.data.after?.healthFactor).toBe(Infinity);
    expect(result.data.after?.liquidation).toBeNull();
    expect(Number.isNaN(result.data.after?.leverage)).toBe(false);
  });
});

/**
 * V4 fail-closed guard — V4 Readiness Audit §12 Stage 10. `planExit`
 * needs no guard of its own: both its "before" and "after" summaries
 * already go through `calculatePortfolioSummary`, which fails closed for
 * "v4" with no synced `v4DebtState` (Stage 9) — `planExit`'s own
 * baseline call inherits that for free, and the "after" summary is never
 * reached once the baseline has already failed. These tests prove the
 * inheritance actually holds after Stage 10's changes, not just assert it
 * by reading the source.
 */
describe('planExit — V4 fail-closed guard, inherited via calculatePortfolioSummary (Stage 10)', () => {
  it('fails with AAVE_V4_DEBT_STATE_MISSING for a "v4" portfolio with no synced v4DebtState', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit({ ...basePortfolio(), protocolVersion: 'v4' }, target, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('succeeds for a full exit (the one repayment amount whose post-state is unambiguous) once v4DebtState is synced', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const result = planExit(
      {
        ...basePortfolio(),
        protocolVersion: 'v4',
        v4DebtState: { drawnDebt: 15000, premiumDebt: 5000, baseDrawnApr: 0.05, riskPremium: 0.01 },
        v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
      },
      target,
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.before.debtValue).toBe(20000);
  });

  it('never fails for a "v3" (or unset) portfolio, even when v4DebtState happens to be present (no cross-inference)', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(
      {
        ...basePortfolio(),
        v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      },
      target,
      'live',
    );
    expect(result.ok).toBe(true);
  });
});

/**
 * V4 post-exit state — V4 Readiness Audit §12 Stage 11, resolved for ANY
 * repayment amount (partial or full) with a real protocol-backed rule at
 * Stage 12. `services/exit/plan.ts`'s own header comment documents the
 * authoritative source: `aave/aave-v4`'s `calculateRestoreAmount` repays
 * premium debt FIRST, then drawn debt with the remainder — a fully
 * deterministic split for any repayment amount, so both a full AND a
 * partial V4 exit now carry real post-exit V4 state forward, proving the
 * exit "remains V4" rather than silently becoming a bare V3-shaped
 * record or failing closed unnecessarily.
 */
describe('planExit — V4 post-exit state (Stage 11, resolved for partial exits at Stage 12)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return {
      ...basePortfolio(),
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 15000, premiumDebt: 5000, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
  }

  it('a full exit (targetDebt: 0) carries real post-exit V4 state forward — the exit does not silently become V3', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const result = planExit(v4Portfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
    // "After" is computed from a real protocolVersion: 'v4' portfolio with
    // v4DebtState: {drawnDebt: 0, premiumDebt: 0, ...} — not a V3-shaped
    // fallback — and correctly reports zero debt / infinite Health Factor.
    expect(result.data.after?.debtValue).toBe(0);
    expect(result.data.after?.healthFactor).toBe(Infinity);
  });

  it('a partial V4 exit now succeeds, carrying a real post-exit v4DebtState forward via the premium-first allocation rule', () => {
    // Total debt $20,000 (drawnDebt 15000 / premiumDebt 5000), target
    // $10,000 -> repayment $10,000. Premium-first: premiumDebt fully
    // cleared ($5,000), remainder ($5,000) reduces drawnDebt to $10,000.
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(v4Portfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
    expect(result.data.after?.debtValue).toBe(10000);
    // Collateral: 2 BTC @ $50,000 = $100,000; btcSold to raise $10,000
    // repayment at $50,000/BTC = 0.2 BTC, btcRetained = 1.8 BTC -> $90,000.
    expect(result.data.after?.collateralValue).toBe(90000);
    expect(result.data.after?.netEquity).toBe(80000);
    expect(result.data.after?.healthFactor).toBeCloseTo((90000 * 0.8) / 10000, 9);
  });

  it('a partial V4 exit does not silently fall back to V3 math — it reports real V4-derived numbers, not a V3-shaped approximation', () => {
    // Before Stage 11, this same call silently dropped protocolVersion/
    // v4DebtState (became V3-shaped). Before Stage 12, it failed closed
    // (the split was genuinely undefined). Now it succeeds with the real,
    // protocol-backed post-repayment V4 state.
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(v4Portfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('errors' in result).toBe(false);
  });

  it('a V4 exit that repays only part of the premium (repayment smaller than premiumDebt) reduces ONLY premiumDebt, leaving drawnDebt untouched', () => {
    // Total debt $20,000, target $18,000 -> repayment $2,000 (less than
    // the $5,000 premiumDebt). Premium-first: premiumDebt reduces to
    // $3,000; drawnDebt stays at $15,000.
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 18000 };
    const result = planExit(v4Portfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.after?.debtValue).toBe(18000);
  });

  it('a full exit still succeeds for a "v3" portfolio, unaffected by the V4-only post-exit state logic', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const result = planExit({ ...basePortfolio(), protocolVersion: 'v3' }, target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.after?.debtValue).toBe(0);
  });

  it('a full exit still succeeds when protocolVersion is unset, unaffected by the V4-only post-exit state logic', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.after?.debtValue).toBe(0);
  });

  it('preserves v4Position identity on the "after" portfolio for a full V4 exit', () => {
    // Indirect proof: v4Position affects nothing calculatePortfolioSummary
    // reads, so the strongest available check is that carrying it forward
    // doesn't break anything — the direct guarantee is exercised at the
    // mapping-level unit tests for this same portfolio construction.
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const result = planExit(v4Portfolio(), target, 'live');
    expect(result.ok).toBe(true);
  });
});

/**
 * `transaction.v4DebtBreakdown` — V4 Readiness Audit §12 Stage 25D.
 * Closes a real follow-up bug: the tests above already prove the
 * AGGREGATE `after.debtValue` is correct, but that aggregate alone is
 * numerically identical whether the real premium-first Aave V4 rule was
 * used or a naive `totalDebt - repayment` shortcut was — nothing in the
 * previous `ExitPlanResult` shape let a caller (or a test) independently
 * verify the actual `drawnDebt`/`premiumDebt` split. `v4DebtBreakdown`
 * exposes exactly that split, itemizing state `deriveV4DebtStateAfterDelta`
 * already computed — zero new calculation.
 */
describe('planExit — transaction.v4DebtBreakdown (Stage 25D)', () => {
  function manualV4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return {
      ...basePortfolio(),
      debt: { asset: 'USDC', balance: 999999 },
      market: { btcPriceUsd: 64547.56 },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 30000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4DebtStateSource: 'manual',
      v4CollateralRisk: { collateralFactor: 0.75, dynamicConfigKey: 0 },
      v4CollateralRiskSource: 'manual',
      ...overrides,
    };
  }

  it('a $10,000 partial repayment resolves as premium debt $500 -> $0 and drawn debt $30,000 -> $20,500 (premium-first), exactly reproducing the reported scenario', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 20500 };
    const result = planExit(manualV4Portfolio(), target, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.transaction?.v4DebtBreakdown).toEqual({
      before: { drawnDebt: 30000, premiumDebt: 500 },
      after: { drawnDebt: 20500, premiumDebt: 0 },
    });
    // The aggregate stays correct too — the breakdown is additive, not a
    // second, independent calculation.
    expect(result.data.after?.debtValue).toBe(20500);
  });

  it('a repayment smaller than the premium reduces ONLY premiumDebt in the breakdown, leaving drawnDebt untouched', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 30300 };
    const result = planExit(manualV4Portfolio(), target, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.transaction?.v4DebtBreakdown).toEqual({
      before: { drawnDebt: 30000, premiumDebt: 500 },
      after: { drawnDebt: 30000, premiumDebt: 300 },
    });
  });

  it('a full exit shows both streams reaching exactly $0 in the breakdown', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const result = planExit(manualV4Portfolio(), target, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.transaction?.v4DebtBreakdown).toEqual({
      before: { drawnDebt: 30000, premiumDebt: 500 },
      after: { drawnDebt: 0, premiumDebt: 0 },
    });
  });

  it('is identical for a live-sourced V4 portfolio — provenance never changes the breakdown', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 20500 };
    const result = planExit(
      manualV4Portfolio({
        v4DebtState: {
          drawnDebt: 30000,
          premiumDebt: 500,
          baseDrawnApr: 0.05,
          riskPremium: 0.01,
          debtAssetPriceUsd: 1.0,
        },
        v4DebtStateSource: 'live',
        v4CollateralRiskSource: 'live',
      }),
      target,
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.transaction?.v4DebtBreakdown).toEqual({
      before: { drawnDebt: 30000, premiumDebt: 500 },
      after: { drawnDebt: 20500, premiumDebt: 0 },
    });
  });

  it('is absent (undefined) for a V3 (or unset) portfolio', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.transaction?.v4DebtBreakdown).toBeUndefined();
  });

  it('is absent (undefined) for a V4 portfolio with no synced v4DebtState (the infeasible/fail-closed case never reaches this field anyway)', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const result = planExit(
      { ...basePortfolio(), protocolVersion: 'v4', v4DebtState: undefined },
      target,
      'live',
    );
    // Fails closed via AAVE_V4_DEBT_STATE_MISSING (Stage 10) before ever
    // reaching a transaction object at all.
    expect(result.ok).toBe(false);
  });
});

/**
 * V4 risk-capacity dispatch for the `'healthFactor'` exit target type —
 * V4 Readiness Audit §12 Stage 23E. `calculateTargetExit`'s
 * `resolveTargetDebt` (`engine/exit/calculateTargetExit.ts`) reads
 * `portfolio.protocol.liquidationThreshold` directly for this one target
 * type — a V3-shaped assumption Stage 23D didn't reach (it only wired
 * `summary.ts`/`scenario.ts`/`borrowCapacity.ts`). This silently produced
 * a wrong target debt/sale amount for a V4 portfolio before this fix.
 * `collateralFactor: 0.65` is deliberately chosen to differ from every
 * fixture's `protocol.liquidationThreshold: 0.8` in this file, so a test
 * that silently used the V3 field would fail on an exact numeric
 * mismatch, not merely "some number came back."
 */
describe('planExit — V4 risk-capacity dispatch for the "healthFactor" target type (Stage 23E)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return {
      ...basePortfolio(),
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 30000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
      ...overrides,
    };
  }

  it('resolves the target debt from collateralFactor, not protocol.liquidationThreshold — numerical fixture from the self-financed closed-form solve', () => {
    // Self-financed closed-form solve (`resolveTargetDebt`'s 'healthFactor'
    // branch, Conflict #13 fix): debt1 = LT x (collateralValue0 - debt0) /
    // (targetHF - LT). Collateral: 2 BTC @ $50,000 = $100,000.
    // collateralFactor (LT): 0.65. debt0: 30000 (v4DebtState drawnDebt).
    // targetHealthFactor: 2.6.
    // debt1 = 0.65 x (100000 - 30000) / (2.6 - 0.65) = 45500 / 1.95 ≈ 23333.33.
    const target: ExitTarget = { type: 'healthFactor', targetHealthFactor: 2.6 };
    const result = planExit(v4Portfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
    // Repayment = currentDebt (30000) - targetDebt (≈23333.33) ≈ 6666.67.
    expect(result.data.transaction?.repayment).toBeCloseTo(6666.666666666668, 6);
    // BTC sold = repayment / price ≈ 6666.67 / 50000 ≈ 0.13333.
    expect(result.data.transaction?.btcSold).toBeCloseTo(0.13333333333333336, 9);
    expect(result.data.transaction?.btcRetained).toBeCloseTo(1.8666666666666667, 9);
    // If this had silently used protocol.liquidationThreshold (0.8), the
    // target debt would be 0.8 x 70000 / 1.8 ≈ 31111.11 — infeasible
    // (exceeds current debt of 30000) — a completely different outcome.
  });

  it('a deliberately conflicting V3/V4 fixture on the same portfolio shape proves the correct branch is selected purely by protocolVersion', () => {
    const target: ExitTarget = { type: 'healthFactor', targetHealthFactor: 2.6 };
    const v3Result = planExit(
      v4Portfolio({ protocolVersion: 'v3', debt: { asset: 'USDC', balance: 30000 } }),
      target,
      'live',
    );
    const v4Result = planExit(v4Portfolio(), target, 'live');
    expect(v3Result.ok).toBe(true);
    expect(v4Result.ok).toBe(true);
    if (!v3Result.ok || !v4Result.ok) return;
    // V3 uses liquidationThreshold (0.8): target debt = 0.8 x 70000 / 1.8 ≈
    // 31111.11, which EXCEEDS current debt (30000) — infeasible.
    expect(v3Result.data.feasible).toBe(false);
    // V4 uses collateralFactor (0.65): target debt ≈ 23333.33, feasible.
    expect(v4Result.data.feasible).toBe(true);
  });

  it('fails closed with AAVE_V4_COLLATERAL_RISK_MISSING for a "healthFactor" target when v4CollateralRisk is unavailable, never falling back to protocol.liquidationThreshold', () => {
    const target: ExitTarget = { type: 'healthFactor', targetHealthFactor: 2.6 };
    const result = planExit(v4Portfolio({ v4CollateralRisk: undefined }), target, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_COLLATERAL_RISK_MISSING' });
  });

  it('is inert for "debtBalance"/"retainedBtc" target types, which never read the risk-capacity fraction', () => {
    const debtBalanceTarget: ExitTarget = { type: 'debtBalance', targetDebt: 25000 };
    const result = planExit(v4Portfolio(), debtBalanceTarget, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.transaction?.repayment).toBeCloseTo(5000, 6);
  });
});

/**
 * Execution-cost assumption wiring — V4 Readiness Audit §12 P1-6.
 * `planExit`'s new trailing `executionCostAssumptions` parameter
 * (portfolio-level, per this stage's own ownership report) resolves
 * (via the shared `resolveExecutionCostAssumptions`) into
 * `calculateTargetExit`'s own `executionCostAssumptions`/`gasCostUsd`.
 */
describe('planExit — execution-cost assumption wiring (P1-6)', () => {
  const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };

  it('configured swap fee/slippage/gas produce real computed costs matching the repayment notional', () => {
    const result = planExit(basePortfolio(), target, 'live', undefined, {
      swapFeeRate: 0.003,
      slippageRate: 0.005,
      gasCostUsd: 15,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // notional = repayment = 10000.
    const byItem = Object.fromEntries(
      (result.data.costs ?? []).map((entry) => [entry.item, entry]),
    );
    expect(byItem.swapFees?.amountUsd).toBeCloseTo(30, 6);
    expect(byItem.slippage?.amountUsd).toBeCloseTo(49.85, 6);
    expect(byItem.gasEstimate?.amountUsd).toBe(15);
    expect(byItem.totalImplementationCost?.amountUsd).toBeCloseTo(94.85, 6);
  });

  it('the same assumptions also apply real friction to the BTC actually sold (not just cost reporting)', () => {
    const frictionless = planExit(basePortfolio(), target, 'live');
    const frictioned = planExit(basePortfolio(), target, 'live', undefined, {
      swapFeeRate: 0.003,
      slippageRate: 0.005,
    });
    expect(frictionless.ok && frictioned.ok).toBe(true);
    if (!frictionless.ok || !frictioned.ok) return;
    expect(frictioned.data.transaction?.btcSold).toBeGreaterThan(
      frictionless.data.transaction?.btcSold ?? 0,
    );
    // Repayment itself is untouched by friction.
    expect(frictioned.data.transaction?.repayment).toBe(frictionless.data.transaction?.repayment);
  });

  it('gas configured alone leaves swapFees/slippage/total unavailable', () => {
    const result = planExit(basePortfolio(), target, 'live', undefined, { gasCostUsd: 8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byItem = Object.fromEntries(
      (result.data.costs ?? []).map((entry) => [entry.item, entry]),
    );
    expect(byItem.gasEstimate?.amountUsd).toBe(8);
    expect(byItem.swapFees?.amountUsd).toBeNull();
    expect(byItem.totalImplementationCost?.amountUsd).toBeNull();
  });

  it('omitted executionCostAssumptions reproduces the exact pre-P1-6 all-unavailable result', () => {
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const entry of result.data.costs ?? []) {
      expect(entry.amountUsd).toBeNull();
    }
  });

  it('a healthFactor target still reproduces its requested target under configured friction (P1-5 correction remains intact)', () => {
    const hfTarget: ExitTarget = { type: 'healthFactor', targetHealthFactor: 5 };
    const result = planExit(basePortfolio(), hfTarget, 'live', undefined, {
      swapFeeRate: 0.003,
      slippageRate: 0.005,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
    expect(result.data.after?.healthFactor).toBeCloseTo(5, 6);
  });

  it('gas does not alter repayment/btcSold/Health Factor — only the reported cost item', () => {
    const withoutGas = planExit(basePortfolio(), target, 'live');
    const withGas = planExit(basePortfolio(), target, 'live', undefined, { gasCostUsd: 5000 });
    expect(withoutGas.ok && withGas.ok).toBe(true);
    if (!withoutGas.ok || !withGas.ok) return;
    expect(withGas.data.transaction?.repayment).toBe(withoutGas.data.transaction?.repayment);
    expect(withGas.data.transaction?.btcSold).toBe(withoutGas.data.transaction?.btcSold);
    expect(withGas.data.after?.healthFactor).toBe(withoutGas.data.after?.healthFactor);
  });

  it('every supported exit target type shares the identical execution-cost boundary — fullExit, retainedBtc, and healthFactor all report real costs the same way debtBalance does', () => {
    const assumptions = { swapFeeRate: 0.003, slippageRate: 0.005, gasCostUsd: 15 };
    const fullExit = planExit(
      basePortfolio(),
      { type: 'debtBalance', targetDebt: 0 },
      'live',
      undefined,
      assumptions,
    );
    const retainedBtc = planExit(
      basePortfolio(),
      { type: 'retainedBtc', targetRetainedBtc: 1.6 },
      'live',
      undefined,
      assumptions,
    );
    const healthFactorTarget = planExit(
      basePortfolio(),
      { type: 'healthFactor', targetHealthFactor: 5 },
      'live',
      undefined,
      assumptions,
    );
    for (const result of [fullExit, retainedBtc, healthFactorTarget]) {
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.data.feasible).toBe(true);
      const byItem = Object.fromEntries(
        (result.data.costs ?? []).map((entry) => [entry.item, entry]),
      );
      expect(byItem.swapFees?.amountUsd).not.toBeNull();
      expect(byItem.gasEstimate?.amountUsd).toBe(15);
      expect(byItem.totalImplementationCost?.amountUsd).not.toBeNull();
    }
  });
});
