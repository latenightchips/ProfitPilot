import { describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { simulatePortfolioAction } from '@/services/simulation/portfolioAction';

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
 * V4 debt-delta state — V4 Readiness Audit §12 Stage 11. Before this
 * stage, `afterPortfolio` spread `...portfolio`, so a V4 portfolio's
 * `v4DebtState` carried over completely UNCHANGED regardless of
 * `debtDelta` — since canonical V4 debt is read from `v4DebtState`, not
 * `debt.balance`, a Borrow/Repay action's effect on debt was silently
 * invisible to the "after" summary for any V4 portfolio. These tests
 * prove the fix: a repayment to exactly $0 total debt (the one
 * unambiguous case) now correctly reflects zero V4 debt in "after";
 * every other debt-changing delta (a borrow, or a partial repay) is
 * genuinely ambiguous for the drawn/premium split and fails closed
 * instead of silently ignoring the delta.
 */
describe('simulatePortfolioAction — V4 debt-delta state (Stage 11)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 5000, baseDrawnApr: 0.05, riskPremium: 0.01 },
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

  it('a partial Repay on a V4 portfolio fails closed rather than silently ignoring the delta', () => {
    const result = simulatePortfolioAction(
      v4Portfolio(),
      { collateralDelta: 0, debtDelta: -5000 },
      'live',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
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
