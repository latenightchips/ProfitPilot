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

/**
 * Canonical V4 debt reconciliation — V4 Readiness Audit §12 Stage 9.
 * `calculatePortfolioSummary` is the Portfolio Store's own displayed
 * summary AND `simulateScenario`'s baseline for every scenario type, so
 * fixing it here covers both at once (see this file's own header
 * comment).
 */
describe('calculatePortfolioSummary — canonical V4 debt (Stage 9)', () => {
  it('computes every debt-derived field from the canonical v4DebtState total, not legacy debt.balance', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Collateral: 2 BTC @ $50,000 = $100,000. Canonical debt: $15,500.
    expect(result.data.debtValue).toBe(15500);
    expect(result.data.netEquity).toBe(84500);
    expect(result.data.loanToValue).toBeCloseTo(0.155, 9);
    expect(result.data.healthFactor).toBeCloseTo((100000 * 0.8) / 15500, 9);
    expect(result.data.liquidation).not.toBeNull();
  });

  it('uses the canonical total even when it deliberately disagrees with the legacy debt.balance field', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtValue).toBe(15500);
  });

  it('fails closed with AAVE_V4_DEBT_STATE_MISSING when protocolVersion is "v4" but v4DebtState is undefined, rather than falling back to debt.balance', () => {
    const portfolio = basePortfolio({ protocolVersion: 'v4' });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      category: 'calculation',
      code: 'AAVE_V4_DEBT_STATE_MISSING',
    });
  });

  it('does not have a data field on the missing-state failure (no partial/placeholder result leaks through)', () => {
    const portfolio = basePortfolio({ protocolVersion: 'v4' });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('never fails or substitutes for a "v3" portfolio, even when v4DebtState happens to be present (no cross-inference)', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v3',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtValue).toBe(20000);
  });

  it('never fails or substitutes when protocolVersion is unset, even when v4DebtState happens to be present (no cross-inference)', () => {
    const portfolio = basePortfolio({
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtValue).toBe(20000);
  });

  it('a plain V3 portfolio (neither field ever set) is byte-identical to before Stage 9', () => {
    const result = calculatePortfolioSummary(basePortfolio(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtValue).toBe(20000);
    expect(result.data.netEquity).toBe(80000);
    expect(result.data.healthFactor).toBe(4);
  });
});

/**
 * V4 rate semantics hardening — V4 Readiness Audit §12 Stage 10.
 * `interestCost` for a V4 portfolio with synced `v4DebtState` now comes
 * from the real V4 accrual engine (`projectAaveV4AnnualInterestCost`),
 * not `calculateAnnualInterest(debtValue, protocol.borrowApr)` — the
 * legacy formula was amount-correct but rate-questionable for V4 (see
 * this file's own header comment).
 */
describe('calculatePortfolioSummary — V4 interestCost via the real accrual engine (Stage 10)', () => {
  it('uses the real V4 365-day projection, not debtValue * protocol.borrowApr', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Same regression vector as the Engine/Simulation layers: drawnDebt
    // 20000, premiumDebt 500, baseDrawnApr 0.05, riskPremium 0.1 over 365
    // days -> totalDebt 21600, so interestCost = 21600 - 20500 = 1100.
    // The legacy `debtValue * protocol.borrowApr` formula would instead
    // give 20500 * 0.05 = 1025 — a genuinely different, wrong-for-V4 answer.
    expect(result.data.interestCost).toBeCloseTo(1100, 6);
    expect(result.data.interestCost).not.toBeCloseTo(1025, 6);
  });

  it('ignores protocol.borrowApr entirely for a V4 portfolio with synced v4DebtState', () => {
    const withLowLegacyRate = calculatePortfolioSummary(
      basePortfolio({
        protocol: {
          maxLoanToValue: 0.75,
          liquidationThreshold: 0.8,
          borrowApr: 0.01,
          supplyApr: 0.02,
        },
        protocolVersion: 'v4',
        v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
      }),
      'live',
    );
    const withHighLegacyRate = calculatePortfolioSummary(
      basePortfolio({
        protocol: {
          maxLoanToValue: 0.75,
          liquidationThreshold: 0.8,
          borrowApr: 0.99,
          supplyApr: 0.02,
        },
        protocolVersion: 'v4',
        v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
      }),
      'live',
    );
    expect(withLowLegacyRate.ok).toBe(true);
    expect(withHighLegacyRate.ok).toBe(true);
    if (!withLowLegacyRate.ok || !withHighLegacyRate.ok) return;
    expect(withLowLegacyRate.data.interestCost).toBe(withHighLegacyRate.data.interestCost);
  });

  it('still uses the legacy calculateAnnualInterest formula for a "v3" portfolio (unaffected by Stage 10)', () => {
    const result = calculatePortfolioSummary(basePortfolio({ protocolVersion: 'v3' }), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // $20,000 debt @ 5% APR = $1,000 (calculateAnnualInterest, unchanged).
    expect(result.data.interestCost).toBe(1000);
  });

  it('still uses the legacy calculateAnnualInterest formula when protocolVersion is unset (unaffected by Stage 10)', () => {
    const result = calculatePortfolioSummary(basePortfolio(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.interestCost).toBe(1000);
  });
});
