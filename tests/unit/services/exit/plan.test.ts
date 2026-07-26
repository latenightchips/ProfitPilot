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
