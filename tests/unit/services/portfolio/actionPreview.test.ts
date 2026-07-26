import { describe, expect, it } from 'vitest';

import type { PortfolioAction } from '@/services/portfolio/actionPreview';
import { previewPortfolioAction } from '@/services/portfolio/actionPreview';
import type { ApplicationPortfolio } from '@/services/portfolio/models';

/**
 * Portfolio Action Preview Service — 06_TASKS.md M3-006.
 *
 * Same base portfolio as `summary.test.ts` (2 BTC @ $50,000, $20,000
 * debt, 75%/80% LTV/liquidation-threshold, 5%/2% borrow/supply APR), with
 * per-action deltas chosen so both "before" and "after" resolve to exact
 * values wherever possible.
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

describe('previewPortfolioAction (M3-006)', () => {
  it('returns unchanged before/after summaries for a hypothetical no-op-equivalent addCollateral of 0', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'addCollateral', quantity: 0 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.before).toEqual(result.data.after);
  });

  it('addCollateral increases collateralValue and every derived metric', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'addCollateral', quantity: 2 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.before.collateralValue).toBe(100000);
    expect(result.data.after.collateralValue).toBe(200000);
    expect(result.data.after.loanToValue).toBe(0.1);
    expect(result.data.after.healthFactor).toBe(8);
    expect(result.data.after.liquidation).toEqual({ price: 6250, distance: 7, buffer: 87.5 });
    expect(result.data.after.interestCost).toBe(1000);
  });

  it('withdrawCollateral decreases collateralValue and every derived metric', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'withdrawCollateral', quantity: 1 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.after.collateralValue).toBe(50000);
    expect(result.data.after.loanToValue).toBe(0.4);
    expect(result.data.after.healthFactor).toBe(2);
    expect(result.data.after.liquidation).toEqual({ price: 25000, distance: 1, buffer: 50 });
  });

  it('borrow increases debtValue, loanToValue, and interestCost; decreases healthFactor', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'borrow', amount: 5000 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.after.loanToValue).toBe(0.25);
    expect(result.data.after.healthFactor).toBe(3.2);
    expect(result.data.after.liquidation).toEqual({ price: 15625, distance: 2.2, buffer: 68.75 });
    expect(result.data.after.interestCost).toBe(1250);
  });

  it('repay decreases debtValue, loanToValue, and interestCost; increases healthFactor', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'repay', amount: 10000 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.after.loanToValue).toBe(0.1);
    expect(result.data.after.healthFactor).toBe(8);
    expect(result.data.after.liquidation).toEqual({ price: 6250, distance: 7, buffer: 87.5 });
    expect(result.data.after.interestCost).toBe(500);
  });

  it('repay to exactly zero debt succeeds with a null liquidation summary (conflict #20 resolved)', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'repay', amount: 20000 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.after.debtValue).toBe(0);
    expect(result.data.after.healthFactor).toBe(Infinity);
    expect(result.data.after.liquidation).toBeNull();
    expect(result.data.after.interestCost).toBe(0);
  });

  it('changeMarketPrice recalculates every price-derived metric', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'changeMarketPrice', btcPriceUsd: 40000 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.after.collateralValue).toBe(80000);
    expect(result.data.after.loanToValue).toBe(0.25);
    expect(result.data.after.healthFactor).toBe(3.2);
    expect(result.data.after.liquidation).toEqual({ price: 12500, distance: 2.2, buffer: 68.75 });
    expect(result.data.after.interestCost).toBe(1000);
  });

  it('changeProtocolParameters recalculates threshold- and rate-derived metrics only', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = {
      type: 'changeProtocolParameters',
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.5,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Unaffected by a liquidationThreshold-only change:
    expect(result.data.after.collateralValue).toBe(result.data.before.collateralValue);
    expect(result.data.after.loanToValue).toBe(result.data.before.loanToValue);
    expect(result.data.after.leverage).toBeCloseTo(result.data.before.leverage, 10);
    // Affected:
    expect(result.data.after.healthFactor).toBe(2.5);
    expect(result.data.after.liquidation).toEqual({ price: 20000, distance: 1.5, buffer: 60 });
  });

  it('does not mutate the original portfolio object', () => {
    const portfolio = basePortfolio();
    const snapshot = JSON.parse(JSON.stringify(portfolio)) as ApplicationPortfolio;
    const action: PortfolioAction = { type: 'borrow', amount: 5000 };
    previewPortfolioAction(portfolio, action, 'live');
    expect(portfolio).toEqual(snapshot);
  });

  it('propagates a "before" Engine failure without computing "after"', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...basePortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    const action: PortfolioAction = { type: 'addCollateral', quantity: 1 };
    const result = previewPortfolioAction(invalidPortfolio, action, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'INVALID_NON_NEGATIVE' });
  });

  it('propagates an "after" Engine failure when an action produces an invalid portfolio (over-withdrawal)', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'withdrawCollateral', quantity: 5 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'INVALID_NON_NEGATIVE' });
  });

  it('propagates an "after" Engine failure when an action produces an invalid portfolio (over-repayment)', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'repay', amount: 25000 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'INVALID_NON_NEGATIVE' });
  });

  it('threads sourceStatus through to both before and after and the final metadata', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'addCollateral', quantity: 1 };
    const result = previewPortfolioAction(portfolio, action, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sourceStatus).toBe('manual');
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const portfolio = basePortfolio();
    const action: PortfolioAction = { type: 'repay', amount: 25000 };
    const result = previewPortfolioAction(portfolio, action, 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });
});
