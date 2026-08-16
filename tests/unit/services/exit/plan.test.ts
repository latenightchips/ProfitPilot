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
 * Revisits conflicts #10 and #13 (both already resolved at the Engine
 * layer by scoping/documented approximation, not by inventing behavior
 * — see `plan.ts`'s header comment). Also exercises conflict #20
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

  it('passes through unavailableCosts rather than inventing a transaction-cost model (conflict #8)', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const items = result.data.unavailableCosts?.map((u) => u.item);
    expect(items).toEqual(expect.arrayContaining(['swapFees', 'slippage', 'gasEstimate']));
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
    expect(result.data.unavailableCosts).toBeNull();
    // The baseline is still reported even when infeasible.
    expect(result.data.before.netEquity).toBe(80000);
  });

  it('supports a healthFactor target and demonstrates the documented F-040 undershoot (conflict #13)', () => {
    const target: ExitTarget = { type: 'healthFactor', targetHealthFactor: 5 };
    const result = planExit(basePortfolio(), target, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
    // F-040 assumes fixed collateral; selling BTC to fund the repayment
    // reduces collateral too, so the actual resulting Health Factor is
    // below the requested target of 5 — documented, not a bug.
    expect(result.data.after?.healthFactor).toBeLessThan(5);
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
 * V4 post-exit state — V4 Readiness Audit §12 Stage 11.
 * `services/exit/plan.ts`'s own header comment documents the exact
 * ambiguity: repaying a V4 portfolio's debt down to exactly $0 is the one
 * case where the post-exit `drawnDebt`/`premiumDebt` split is a
 * mathematical certainty (both must be $0), so a full V4 exit now carries
 * real post-exit V4 state forward — proving the exit "remains V4" rather
 * than silently becoming a bare V3-shaped record. A PARTIAL V4 exit's
 * split is genuinely undefined in this codebase's own documented model
 * (no repayment-allocation policy exists anywhere in `engine/protocols/aaveV4`
 * or `docs/overview.md`), so it fails closed via the existing
 * `AAVE_V4_DEBT_STATE_MISSING` guard rather than guessing.
 */
describe('planExit — V4 post-exit state (Stage 11)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return {
      ...basePortfolio(),
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 15000, premiumDebt: 5000, baseDrawnApr: 0.05, riskPremium: 0.01 },
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

  it('a partial V4 exit fails closed with AAVE_V4_DEBT_STATE_MISSING — the drawn/premium split for a partial repayment is genuinely undefined, not guessed', () => {
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(v4Portfolio(), target, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('a partial V4 exit does not silently fall back to V3 math either — it fails rather than reporting a wrong "after" state', () => {
    // Before Stage 11, this same call SUCCEEDED with a V3-shaped "after"
    // portfolio (protocolVersion/v4DebtState both dropped) — i.e. it
    // silently became V3. Stage 11 changes this to a real failure instead
    // of a silently-wrong success.
    const target: ExitTarget = { type: 'debtBalance', targetDebt: 10000 };
    const result = planExit(v4Portfolio(), target, 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
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
