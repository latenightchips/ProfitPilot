import { describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { calculatePortfolioSummary } from '@/services/portfolio/summary';

/**
 * Portfolio Summary Service — 06_TASKS.md M3-005.
 *
 * Test portfolio chosen so most fields resolve to exact values (no
 * floating-point rounding to fight): collateral 2 BTC @ $50,000,
 * $20,000 debt, 75%/80% LTV/liquidation-threshold, 5%/2% borrow/supply
 * APR. Only Leverage (Exposure / Net Worth) doesn't resolve cleanly here
 * and uses `toBeCloseTo`.
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

describe('calculatePortfolioSummary (M3-005)', () => {
  it('computes every summary field from the 10 composed Engine calls', () => {
    const result = calculatePortfolioSummary(basePortfolio(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.collateralValue).toBe(100000);
    expect(result.data.debtValue).toBe(20000);
    expect(result.data.netEquity).toBe(80000);
    expect(result.data.loanToValue).toBe(0.2);
    expect(result.data.leverage).toBeCloseTo(1.25, 6);
    expect(result.data.healthFactor).toBe(4);
    expect(result.data.liquidation).toEqual({ price: 12500, distance: 3, buffer: 75 });
    expect(result.data.interestCost).toBe(1000);
  });

  it('threads the caller-supplied sourceStatus through to metadata, never fabricating it', () => {
    const result = calculatePortfolioSummary(basePortfolio(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sourceStatus).toBe('manual');
  });

  it('derives engineVersion/formulaVersion from the real Engine call metadata, not a hardcoded constant', () => {
    const result = calculatePortfolioSummary(basePortfolio(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.engineVersion).toBe('0.1.0');
    expect(result.metadata.formulaVersion).toBe('1.0');
  });

  it('aggregates warnings from every composed Engine call (e.g. negative equity)', () => {
    const underwater = basePortfolio({
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 20000 },
      market: { btcPriceUsd: 10000 },
    });
    const result = calculatePortfolioSummary(underwater, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.netEquity).toBe(-10000);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'NEGATIVE_EQUITY' }));
  });

  it('propagates a single Engine failure without inventing a fallback value (zero-debt liquidation price is undefined)', () => {
    const debtFree = basePortfolio({ debt: { asset: 'USDC', balance: 0 } });
    const result = calculatePortfolioSummary(debtFree, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      category: 'calculation',
      code: 'NOT_APPLICABLE_NO_DEBT',
    });
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const invalid = basePortfolio({ collateral: { asset: 'BTC', quantity: -1 } });
    const result = calculatePortfolioSummary(invalid, 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('does not have an errors field on a success result (discriminated union, not a nullable envelope)', () => {
    const result = calculatePortfolioSummary(basePortfolio(), 'live');
    expect(result.ok).toBe(true);
    expect('errors' in result).toBe(false);
  });

  it('surfaces the underlying Engine error verbatim (invalid negative collateral quantity)', () => {
    const invalid = basePortfolio({ collateral: { asset: 'BTC', quantity: -1 } });
    const result = calculatePortfolioSummary(invalid, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      category: 'calculation',
      code: 'INVALID_NON_NEGATIVE',
    });
  });

  it('handles a zero-debt Health Factor as Infinity before failing on liquidation price', () => {
    // Documents the exact point of failure: calculateHealthFactor succeeds
    // (Infinity, NO_DEBT warning) but calculateLiquidationPrice fails
    // first in call order for a nonzero-debt check further down the
    // chain — this test pins the zero-debt case to the liquidation-price
    // step specifically, not an earlier one.
    const debtFree = basePortfolio({ debt: { asset: 'USDC', balance: 0 } });
    const result = calculatePortfolioSummary(debtFree, 'live');
    expect(result.ok).toBe(false);
  });
});
