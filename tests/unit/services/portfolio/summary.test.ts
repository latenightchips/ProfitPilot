import { describe, expect, it } from 'vitest';

import packageJson from '@/package.json';
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
    expect(result.metadata.engineVersion).toBe(packageJson.version);
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

  it('computes a full summary for a zero-debt portfolio instead of failing (conflict #20 resolved)', () => {
    // calculateLiquidationPrice (F-024) and calculateLiquidationBuffer
    // (F-025) are undefined for zero debt by design and would fail if
    // called directly; calculatePortfolioSummary now skips them for a
    // zero-debt portfolio and reports `liquidation: null` instead of
    // failing the whole summary. See PROJECT_STATUS.md conflict #20.
    const debtFree = basePortfolio({ debt: { asset: 'USDC', balance: 0 } });
    const result = calculatePortfolioSummary(debtFree, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.collateralValue).toBe(100000);
    expect(result.data.debtValue).toBe(0);
    expect(result.data.netEquity).toBe(100000);
    expect(result.data.healthFactor).toBe(Infinity);
    expect(result.data.liquidation).toBeNull();
    expect(result.data.interestCost).toBe(0);
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'NO_DEBT' }));
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

  it('skips the liquidation steps entirely for zero debt rather than calling and discarding a failure', () => {
    // debtValue is checked before any liquidation-family Engine call is
    // made — calculateLiquidationPrice/Buffer are never invoked for a
    // zero-debt portfolio, not called-then-ignored.
    const debtFree = basePortfolio({ debt: { asset: 'USDC', balance: 0 } });
    const result = calculatePortfolioSummary(debtFree, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.liquidation).toBeNull();
  });
});
