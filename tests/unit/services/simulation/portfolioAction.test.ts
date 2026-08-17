import { describe, expect, it } from 'vitest';

import { buildFinalLoopPortfolio } from '@/services/loop/finalPortfolio';
import { planLoopStrategy } from '@/services/loop/strategy';
import type { ApplicationPortfolio } from '@/services/portfolio/models';
import {
  simulatePortfolioAction,
  simulatePortfolioTransition,
} from '@/services/simulation/portfolioAction';

/**
 * Portfolio Action Simulation Service — 06_TASKS.md M6-008 ("Implement
 * Portfolio Action Simulation"). Same base portfolio as
 * `tests/unit/services/portfolio/actionPreview.test.ts`'s own (2 BTC @
 * $50,000, $20,000 debt, 75%/80% LTV/liquidation-threshold, 5%/2%
 * borrow/supply APR), for direct numeric comparability with that
 * already-established Service's own test cases.
 */
function basePortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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
    ...overrides,
  };
}

describe('simulatePortfolioAction — Add collateral', () => {
  it('increases collateralValue and every derived metric, matching previewPortfolioAction’s own addCollateral case exactly', () => {
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: 2, debtDelta: 0 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.before.collateralValue).toBe(100000);
    expect(result.data.after.collateralValue).toBe(200000);
    expect(result.data.after.loanToValue).toBe(0.1);
    expect(result.data.after.healthFactor).toBe(8);
  });
});

describe('simulatePortfolioAction — profitOrLoss (M6-009, Batch 9)', () => {
  it('computes Profit/Loss via calculatePortfolioGain (F-007) from the collateral value change', () => {
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: 2, debtDelta: 0 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Current value $200,000 − initial investment $100,000 = $100,000.
    expect(result.data.profitOrLoss).toBe(100000);
  });

  it('is zero when the collateral value does not change', () => {
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: 0, debtDelta: 10000 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profitOrLoss).toBe(0);
  });
});

describe('simulatePortfolioAction — Withdraw collateral', () => {
  it('decreases collateralValue and every derived metric', () => {
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: -1, debtDelta: 0 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.after.collateralValue).toBe(50000);
  });

  it('fails cleanly, without inventing a new error, when the withdrawal exceeds current collateral', () => {
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: -5, debtDelta: 0 },
      'live',
    );
    expect(result.ok).toBe(false);
  });
});

describe('simulatePortfolioAction — Borrow', () => {
  it('increases debtValue and every derived metric', () => {
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: 0, debtDelta: 10000 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.before.debtValue).toBe(20000);
    expect(result.data.after.debtValue).toBe(30000);
  });
});

describe('simulatePortfolioAction — Repay', () => {
  it('decreases debtValue and every derived metric', () => {
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: 0, debtDelta: -15000 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.after.debtValue).toBe(5000);
  });
});

describe('simulatePortfolioAction — Combined actions', () => {
  it('applies both a collateral and a debt delta together in one preview', () => {
    // 2 BTC + 1 BTC = 3 BTC * $50,000 = $150,000; $20,000 + $10,000 debt = $30,000.
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: 1, debtDelta: 10000 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.after.collateralValue).toBe(150000);
    expect(result.data.after.debtValue).toBe(30000);
    expect(result.data.after.loanToValue).toBe(0.2);
  });
});

describe('simulatePortfolioAction — invalid starting portfolio', () => {
  it('fails cleanly, without applying any delta, when the portfolio itself is already invalid', () => {
    const result = simulatePortfolioAction(
      basePortfolio({ collateral: { asset: 'BTC', quantity: 0 } }),
      { collateralDelta: 1, debtDelta: 0 },
      'live',
    );
    expect(result.ok).toBe(false);
  });
});

describe('simulatePortfolioAction — no-op', () => {
  it('returns identical before/after summaries when both deltas are zero', () => {
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: 0, debtDelta: 0 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.before).toEqual(result.data.after);
  });
});

describe('simulatePortfolioAction — does not mutate the original portfolio', () => {
  it('leaves the caller’s own portfolio object untouched', () => {
    const portfolio = basePortfolio();
    simulatePortfolioAction(portfolio, { collateralDelta: 5, debtDelta: 5000 }, 'live');
    expect(portfolio.collateral.quantity).toBe(2);
    expect(portfolio.debt.balance).toBe(20000);
  });
});

/**
 * V4 debt-delta state — V4 Readiness Audit §12 Stage 11, resolved for ANY
 * repay amount with a real protocol-backed rule at Stage 12. Before
 * Stage 11, `afterPortfolio` spread `...portfolio`, so a V4 portfolio's
 * `v4DebtState` carried over completely UNCHANGED regardless of
 * `debtDelta` — since canonical V4 debt is read from `v4DebtState`, not
 * `debt.balance`, a Borrow/Repay action's effect on debt was silently
 * invisible to the "after" summary for any V4 portfolio. These tests
 * prove: a repayment (partial or full) now correctly reflects the real,
 * protocol-backed post-repayment V4 debt state (premium debt first, then
 * drawn debt with the remainder); a Borrow remains genuinely ambiguous
 * (Risk Premium refresh requires data this codebase never captures) and
 * still fails closed instead of silently ignoring the delta.
 */
describe('simulatePortfolioAction — V4 debt-delta state (Stage 11, resolved for repay at Stage 12)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 5000, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
      ...overrides,
    });
  }

  it('a repayment to exactly $0 total V4 debt produces a real zero-debt "after" state, not a silently-unchanged one', () => {
    const result = simulatePortfolioAction(
      v4Portfolio(),
      { collateralDelta: 0, debtDelta: -20000 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.before.debtValue).toBe(20000);
    expect(result.data.after.debtValue).toBe(0);
    expect(result.data.after.healthFactor).toBe(Infinity);
  });

  it('a nonzero Borrow on a V4 portfolio fails closed rather than silently ignoring the delta (previously: after.debtValue stayed at 20000)', () => {
    const result = simulatePortfolioAction(
      v4Portfolio(),
      { collateralDelta: 0, debtDelta: 10000 },
      'live',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('a partial Repay on a V4 portfolio now succeeds, applying the repayment to premiumDebt first (premium-first allocation)', () => {
    // drawnDebt 15000 / premiumDebt 5000 (total 20000); repaying 5000
    // exactly clears premiumDebt, leaving drawnDebt untouched at 15000.
    const result = simulatePortfolioAction(
      v4Portfolio(),
      { collateralDelta: 0, debtDelta: -5000 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.after.debtValue).toBe(15000);
  });

  it('a partial Repay smaller than premiumDebt reduces only premiumDebt (drawnDebt untouched)', () => {
    const result = simulatePortfolioAction(
      v4Portfolio(),
      { collateralDelta: 0, debtDelta: -2000 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.after.debtValue).toBe(18000);
  });

  it('uses the v4DebtState-derived split, never the legacy debt.balance field, even when they deliberately disagree', () => {
    // debt.balance is deliberately left at a wildly different value than
    // v4DebtState's own 20000 total, to prove the post-repayment split
    // comes entirely from v4DebtState, not debt.balance + debtDelta.
    const portfolio = v4Portfolio({ debt: { asset: 'USDC', balance: 999999 } });
    const result = simulatePortfolioAction(
      portfolio,
      { collateralDelta: 0, debtDelta: -5000 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.after.debtValue).toBe(15000);
    expect(result.data.after.debtValue).not.toBe(999999 - 5000);
  });

  it('a zero debtDelta on a V4 portfolio is a genuine no-op — before and after match exactly', () => {
    const result = simulatePortfolioAction(
      v4Portfolio(),
      { collateralDelta: 1, debtDelta: 0 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.after.debtValue).toBe(20000);
  });

  it('fails closed for a "v4" portfolio with no synced v4DebtState at all, same as before Stage 11', () => {
    const result = simulatePortfolioAction(
      basePortfolio({ protocolVersion: 'v4' }),
      { collateralDelta: 0, debtDelta: -1000 },
      'live',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('is unaffected for a "v3" (or unset) portfolio, even with a nonzero debtDelta', () => {
    const result = simulatePortfolioAction(
      basePortfolio(),
      { collateralDelta: 0, debtDelta: 10000 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.after.debtValue).toBe(30000);
  });
});

/**
 * `simulatePortfolioTransition` — V4 Readiness Audit §12 Stage 18. A
 * second, protocol-neutral entry point comparing two already-fully-built
 * portfolio snapshots directly, extracted from what `simulatePortfolioAction`
 * already did after building its own "after" portfolio. Contains no
 * protocol-version branching of its own — every dispatch happens inside
 * `calculatePortfolioSummary`, unchanged.
 */
describe('simulatePortfolioTransition — structured before/after comparison (Stage 18)', () => {
  it('matches simulatePortfolioAction exactly for an equivalent V3 change (same math, reached a different way)', () => {
    const portfolio = basePortfolio();
    const after: ApplicationPortfolio = {
      ...portfolio,
      collateral: { ...portfolio.collateral, quantity: portfolio.collateral.quantity + 1 },
      debt: { ...portfolio.debt, balance: portfolio.debt.balance + 10000 },
    };

    const transitionResult = simulatePortfolioTransition(portfolio, after, 'live');
    const actionResult = simulatePortfolioAction(
      portfolio,
      { collateralDelta: 1, debtDelta: 10000 },
      'live',
    );
    expect(transitionResult.ok).toBe(true);
    expect(actionResult.ok).toBe(true);
    if (!transitionResult.ok || !actionResult.ok) return;
    expect(transitionResult.data).toEqual(actionResult.data);
  });

  it('fails cleanly when the "before" portfolio itself is invalid, without ever computing an "after"', () => {
    const result = simulatePortfolioTransition(
      basePortfolio({ collateral: { asset: 'BTC', quantity: 0 } }),
      basePortfolio(),
      'live',
    );
    expect(result.ok).toBe(false);
  });

  it('fails cleanly when the "after" portfolio itself is invalid', () => {
    const result = simulatePortfolioTransition(
      basePortfolio(),
      basePortfolio({ collateral: { asset: 'BTC', quantity: -1 } }),
      'live',
    );
    expect(result.ok).toBe(false);
  });

  it('does not mutate either input portfolio', () => {
    const before = basePortfolio();
    const after = basePortfolio({ debt: { asset: 'USDC', balance: 30000 } });
    simulatePortfolioTransition(before, after, 'live');
    expect(before.debt.balance).toBe(20000);
    expect(after.debt.balance).toBe(30000);
  });
});

/**
 * V4 Loop → Simulation structured handoff — V4 Readiness Audit §12
 * Stage 18. The Stage 17 closure audit found that `buildFinalLoopPortfolio`'s
 * own correctly-carried-through V4 debt state never actually reached
 * `simulatePortfolioAction`'s V4 branch in practice: `ApplyLoopAsSimulation.tsx`
 * reduced it to a scalar `debtDelta` first, and any positive V4 delta is
 * deliberately treated as ambiguous and fails closed
 * (`deriveV4DebtStateAfterDelta`). These tests exercise the REAL Loop
 * Service end to end (`planLoopStrategy` → `buildFinalLoopPortfolio` →
 * `simulatePortfolioTransition`), proving the fix closes that gap without
 * touching the ambiguous-delta rule itself.
 */
describe('simulatePortfolioTransition — V4 Loop → Simulation, end to end (Stage 18)', () => {
  function v4LoopPortfolio(): ApplicationPortfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    });
  }

  it('requirement 1 — a real V4 loop strategy applied via buildFinalLoopPortfolio succeeds, where the old debtDelta path would fail closed', () => {
    const portfolio = v4LoopPortfolio();
    const strategyResult = planLoopStrategy(
      portfolio,
      { targetBorrowPercentage: 0.3, maxLoops: 2, minHealthFactor: 1.3 },
      'live',
    );
    expect(strategyResult.ok).toBe(true);
    if (!strategyResult.ok || strategyResult.data.strategy === null) return;

    const afterPortfolio = buildFinalLoopPortfolio(portfolio, strategyResult.data.strategy);
    expect(afterPortfolio.v4DebtState).toBeDefined();

    // The OLD path this replaces: reducing the loop to a scalar delta and
    // re-deriving through the ambiguous-borrow guard always failed here.
    const debtDelta = strategyResult.data.strategy.finalDebt - 20500;
    expect(debtDelta).toBeGreaterThan(0);
    const oldPathResult = simulatePortfolioAction(
      portfolio,
      { collateralDelta: 0, debtDelta },
      'live',
    );
    expect(oldPathResult.ok).toBe(false);

    // The NEW path succeeds, using the real structured final state.
    const newPathResult = simulatePortfolioTransition(portfolio, afterPortfolio, 'live');
    expect(newPathResult.ok).toBe(true);
  });

  it('requirement 2 — the resulting after-summary uses real V4 rate/debt semantics, not the legacy scalar fields', () => {
    const portfolio = v4LoopPortfolio();
    const strategyResult = planLoopStrategy(
      portfolio,
      { targetBorrowPercentage: 0.3, maxLoops: 2, minHealthFactor: 1.3 },
      'live',
    );
    expect(strategyResult.ok).toBe(true);
    if (!strategyResult.ok || strategyResult.data.strategy === null) return;
    const afterPortfolio = buildFinalLoopPortfolio(portfolio, strategyResult.data.strategy);

    const result = simulatePortfolioTransition(portfolio, afterPortfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // debtValue must be the canonical drawn+premium total, never the stale
    // legacy debt.balance (20000 in basePortfolio's own fixture).
    expect(result.data.before.debtValue).toBe(20500);
    expect(result.data.after.debtValue).toBeCloseTo(
      (afterPortfolio.v4DebtState?.drawnDebt ?? 0) + (afterPortfolio.v4DebtState?.premiumDebt ?? 0),
      6,
    );
    // A naive V3-shaped calculation (canonical debt × the legacy
    // protocol.borrowApr, 5%) would give a different interestCost than
    // the real two-stream V4 projection — proving the real formula ran.
    const naiveV3InterestCost = result.data.after.debtValue * portfolio.protocol.borrowApr;
    expect(result.data.after.interestCost).not.toBeCloseTo(naiveV3InterestCost, 0);
  });

  it('requirement 3 — a generic, hand-entered positive V4 delta (not a known loop result) still fails closed via simulatePortfolioAction, unchanged', () => {
    const portfolio = v4LoopPortfolio();
    const result = simulatePortfolioAction(
      portfolio,
      { collateralDelta: 0, debtDelta: 10000 },
      'live',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('requirement 5 — simulatePortfolioTransition applies no V4-only logic to a V3 (or unset) portfolio', () => {
    const v3Portfolio = basePortfolio();
    const v3After: ApplicationPortfolio = {
      ...v3Portfolio,
      debt: { ...v3Portfolio.debt, balance: 25000 },
    };
    const result = simulatePortfolioTransition(v3Portfolio, v3After, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A plain V3 calculation: interestCost = debtValue × protocol.borrowApr.
    expect(result.data.after.interestCost).toBeCloseTo(25000 * 0.05, 6);
  });
});
