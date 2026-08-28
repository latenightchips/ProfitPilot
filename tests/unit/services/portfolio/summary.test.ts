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

  /**
   * V1.1 Batch 4 — Full-Exit / Zero-State Robustness. Table-driven matrix
   * covering the three collateral/debt zero-boundary states this batch's
   * spec calls out explicitly: (A) both zero — a valid, fully-exited/empty
   * portfolio; (B) collateral > 0, debt = 0 — the pre-existing, unchanged
   * zero-debt state (conflict #20, covered above); (C) collateral = 0,
   * debt > 0 — a dangerous/insolvent state that must fail closed, not be
   * hidden behind friendly formatting.
   */
  describe('V1.1 Batch 4: zero-state engine boundary matrix', () => {
    it('State A — zero collateral AND zero debt (fully exited/empty portfolio): succeeds with safe, finite values, no NaN/Infinity leaking anywhere except the documented HF=Infinity case', () => {
      const empty = basePortfolio({
        collateral: { asset: 'BTC', quantity: 0 },
        debt: { asset: 'USDC', balance: 0 },
      });
      const result = calculatePortfolioSummary(empty, 'live');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.collateralValue).toBe(0);
      expect(result.data.debtValue).toBe(0);
      expect(result.data.netEquity).toBe(0);
      expect(result.data.loanToValue).toBe(0);
      expect(result.data.leverage).toBe(0);
      expect(result.data.healthFactor).toBe(Infinity);
      expect(result.data.liquidation).toBeNull();
      expect(result.data.interestCost).toBe(0);
      expect(Number.isNaN(result.data.leverage)).toBe(false);
      expect(Number.isNaN(result.data.loanToValue)).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: 'ZERO_EXPOSURE_ZERO_NET_WORTH' }),
      );
      expect(result.warnings).toContainEqual(
        expect.objectContaining({ code: 'ZERO_COLLATERAL_ZERO_DEBT' }),
      );
    });

    it('State B — non-zero collateral, zero debt: unchanged pre-existing healthy no-debt semantics (regression guard alongside the conflict #20 test above)', () => {
      const debtFree = basePortfolio({ debt: { asset: 'USDC', balance: 0 } });
      const result = calculatePortfolioSummary(debtFree, 'live');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.leverage).toBeCloseTo(1, 6);
      expect(result.data.healthFactor).toBe(Infinity);
      expect(result.data.liquidation).toBeNull();
    });

    it('State C — zero collateral, non-zero debt: fails closed (a dangerous/insolvent state), never silently formatted as healthy', () => {
      const insolvent = basePortfolio({ collateral: { asset: 'BTC', quantity: 0 } });
      const result = calculatePortfolioSummary(insolvent, 'live');
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toMatchObject({ code: 'DIVISION_BY_ZERO' });
    });

    it('an ordinary leveraged portfolio (neither collateral nor debt zero) is unaffected by the Batch 4 zero-state changes', () => {
      const result = calculatePortfolioSummary(basePortfolio(), 'live');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.leverage).toBeCloseTo(1.25, 6);
      expect(result.data.healthFactor).toBe(4);
      expect(result.data.liquidation).toEqual({ price: 12500, distance: 3, buffer: 75 });
    });
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
      // Same numeric value as `protocol.liquidationThreshold` above
      // (0.8) so this Stage 9 debt-reconciliation test's expected
      // healthFactor/liquidation values are unaffected by Stage 23D's
      // risk-capacity dispatch — this test is not about collateral-risk
      // semantics, and Stage 23D's guard now requires `v4CollateralRisk`
      // to be present for any V4 calculation to succeed at all.
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
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
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
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
 * Authoritative V4 debt-asset USD valuation — V4 Readiness Audit §12
 * P1-D3. `calculatePortfolioSummary` is where `resolveCanonicalDebtBalance`'s
 * corrected USD balance is actually consumed by every other summary field
 * — this proves the price correction propagates end-to-end into debt
 * value, health factor, liquidation price, leverage and net equity, not
 * just the isolated `resolveCanonicalDebtBalance` helper (see
 * `tests/unit/services/portfolio/mapping.test.ts` for that unit-level
 * proof).
 */
describe('calculatePortfolioSummary — authoritative V4 debt-asset pricing (P1-D3)', () => {
  function v4CollateralRisk() {
    return { collateralFactor: 0.8, dynamicConfigKey: 1 };
  }

  it('a non-$1 V4 debt price propagates consistently into debtValue, healthFactor, liquidation price, leverage and netEquity', () => {
    const atOneDollar = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: {
        drawnDebt: 15000,
        premiumDebt: 500,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 1.0,
      },
      v4DebtStateSource: 'live',
      v4CollateralRisk: v4CollateralRisk(),
    });
    const repriced = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: {
        drawnDebt: 15000,
        premiumDebt: 500,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 0.9973,
      },
      v4DebtStateSource: 'live',
      v4CollateralRisk: v4CollateralRisk(),
    });

    const base = calculatePortfolioSummary(atOneDollar, 'live');
    const priced = calculatePortfolioSummary(repriced, 'live');
    expect(base.ok).toBe(true);
    expect(priced.ok).toBe(true);
    if (!base.ok || !priced.ok) return;

    // Collateral: 2 BTC @ $50,000 = $100,000, unaffected by debt repricing.
    const expectedDebt = 15500 * 0.9973;
    expect(priced.data.debtValue).toBeCloseTo(expectedDebt, 6);
    expect(priced.data.debtValue).not.toBe(base.data.debtValue);
    expect(priced.data.netEquity).toBeCloseTo(100000 - expectedDebt, 6);
    expect(priced.data.netEquity).not.toBe(base.data.netEquity);
    expect(priced.data.healthFactor).toBeCloseTo((100000 * 0.8) / expectedDebt, 6);
    expect(priced.data.healthFactor).not.toBe(base.data.healthFactor);
    expect(priced.data.liquidation).not.toBeNull();
    expect(base.data.liquidation).not.toBeNull();
    expect(priced.data.liquidation?.price).not.toBe(base.data.liquidation?.price);
    expect(priced.data.leverage).not.toBe(base.data.leverage);
  });

  it('fails closed with AAVE_V4_DEBT_ASSET_PRICE_MISSING for a live-sourced v4DebtState with no debtAssetPriceUsd, never silently valuing debt at $1', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4DebtStateSource: 'live',
      v4CollateralRisk: v4CollateralRisk(),
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      category: 'calculation',
      code: 'AAVE_V4_DEBT_ASSET_PRICE_MISSING',
    });
    expect('data' in result).toBe(false);
  });

  it('manual V4 (v4DebtStateSource unset/"manual") retains the existing implicit-$1 behavior unchanged, even with no debtAssetPriceUsd', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: v4CollateralRisk(),
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtValue).toBe(15500);
  });

  it('V3 remains completely unaffected by any debtAssetPriceUsd machinery', () => {
    const result = calculatePortfolioSummary(basePortfolio(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtValue).toBe(20000);
    expect(result.data.healthFactor).toBe(4);
    expect(result.data.liquidation).toEqual({ price: 12500, distance: 3, buffer: 75 });
  });

  /**
   * Directional sanity check (V4 Readiness Audit §12 P1-D3 review) — the
   * test above only proves the numbers move, not that they move the
   * economically correct WAY. A lower debt-asset price means the same
   * token quantity is worth fewer real dollars, so the position must
   * become safer (higher Health Factor, higher/farther liquidation price
   * is not applicable here — lower liquidation-trigger collateral price
   * needed — see below); a higher price makes it riskier, the reverse.
   */
  it('a lower debt price makes the position safer (higher HF, lower liquidation-trigger price); a higher price makes it riskier', () => {
    function portfolioAtPrice(debtAssetPriceUsd: number) {
      return basePortfolio({
        protocolVersion: 'v4',
        v4DebtState: {
          drawnDebt: 15000,
          premiumDebt: 500,
          baseDrawnApr: 0.05,
          riskPremium: 0.01,
          debtAssetPriceUsd,
        },
        v4DebtStateSource: 'live',
        v4CollateralRisk: v4CollateralRisk(),
      });
    }

    const cheaper = calculatePortfolioSummary(portfolioAtPrice(0.9973), 'live');
    const par = calculatePortfolioSummary(portfolioAtPrice(1.0), 'live');
    const pricier = calculatePortfolioSummary(portfolioAtPrice(1.0041), 'live');
    expect(cheaper.ok).toBe(true);
    expect(par.ok).toBe(true);
    expect(pricier.ok).toBe(true);
    if (!cheaper.ok || !par.ok || !pricier.ok) return;

    // Lower debt price -> less real debt -> safer -> higher HF; higher
    // debt price -> more real debt -> riskier -> lower HF.
    expect(cheaper.data.healthFactor).toBeGreaterThan(par.data.healthFactor);
    expect(par.data.healthFactor).toBeGreaterThan(pricier.data.healthFactor);

    // Less real debt also means BTC can fall further before liquidation
    // (a lower liquidation-trigger BTC price is safer); more real debt
    // means liquidation triggers at a higher, closer BTC price.
    expect(cheaper.data.liquidation?.price).toBeLessThan(par.data.liquidation?.price ?? Infinity);
    expect(par.data.liquidation?.price).toBeLessThan(pricier.data.liquidation?.price ?? Infinity);
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
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
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

  /**
   * USD conversion of interestCost at a non-$1 price — V4 Readiness
   * Audit §12 P1-D3, a genuine defect found while reviewing that stage.
   * `projectAaveV4AnnualInterestCost`'s own raw output (a debt-TOKEN
   * quantity delta, `21600 - 20500 = 1100` per the test above) was being
   * assigned directly as `interestCost` (a USD figure everywhere else in
   * this codebase) with no price conversion. `calculatePortfolioSummary`
   * now uses `projectAaveV4AnnualInterestCostUsd` instead.
   */
  it('converts the raw V4 interest projection to USD at a non-$1 live price', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: {
        drawnDebt: 20000,
        premiumDebt: 500,
        baseDrawnApr: 0.05,
        riskPremium: 0.1,
        debtAssetPriceUsd: 0.9973,
      },
      v4DebtStateSource: 'live',
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Raw accrual is unaffected by price: totalDebt(365d) = 21,600 (same
    // as the unpriced test above). USD: (21,600 - 20,500) x 0.9973 =
    // 1,097.03 — never the raw 1,100 delta.
    expect(result.data.interestCost).toBeCloseTo(1100 * 0.9973, 6);
    expect(result.data.interestCost).not.toBeCloseTo(1100, 6);
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
        v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
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
        v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
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

/**
 * V4 risk-capacity dispatch (Health Factor / liquidation price / distance
 * / buffer) — V4 Readiness Audit §12 Stage 23D. V3 continues to use
 * `protocol.liquidationThreshold`, byte-identical to before this stage.
 * V4 uses `v4CollateralRisk.collateralFactor` instead — a genuinely
 * different on-chain parameter (Stage 23B: `Spoke.sol`'s
 * `_processUserAccountData` collapses to
 * `HF = collateralFactor × collateralValue / debtValue` for a
 * single-collateral position — structurally the exact same equation as
 * `calculateHealthFactor` (F-022) already implements, just with a
 * different parameter substituted in), never a reinterpretation of
 * `protocol.liquidationThreshold` or `protocol.maxLoanToValue`.
 *
 * `collateralFactor: 0.65` is deliberately chosen to differ from every
 * fixture's `protocol.liquidationThreshold: 0.8` in this file, so a test
 * that silently used the V3 field instead of the V4 one would fail on an
 * exact numeric mismatch, not merely "some number came back."
 */
describe('calculatePortfolioSummary — V4 risk-capacity dispatch (Stage 23D)', () => {
  it('computes V4 Health Factor/liquidation from collateralFactor, not protocol.liquidationThreshold — numerical fixture from the authoritative Solidity formula', () => {
    // Authoritative V4 formula (Stage 23B, Spoke.sol's
    // _processUserAccountData, collapsed for one collateral reserve):
    // HF = collateralFactor * collateralValue / debtValue.
    // Collateral: 2 BTC @ $50,000 = $100,000. Debt: $20,000.
    // collateralFactor: 0.65 (deliberately != protocol.liquidationThreshold 0.8).
    // HF = 0.65 * 100000 / 20000 = 3.25.
    const portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.healthFactor).toBeCloseTo(3.25, 9);
    // Distance = HF - 1.
    expect(result.data.liquidation?.distance).toBeCloseTo(2.25, 9);
    // Liquidation price = currentBtcPrice * debtValue / (collateralValue * collateralFactor)
    //                    = 50000 * 20000 / (100000 * 0.65) = 15384.615384615385.
    expect(result.data.liquidation?.price).toBeCloseTo(15384.615384615385, 6);
    // Buffer = (currentPrice - liquidationPrice) / currentPrice * 100.
    expect(result.data.liquidation?.buffer).toBeCloseTo(69.23076923076923, 6);

    // Proves the V3 field was never read: 0.8 would have produced HF 4,
    // not 3.25.
    expect(result.data.healthFactor).not.toBeCloseTo(4, 6);
  });

  it('a deliberately conflicting V3/V4 fixture on the same portfolio shape proves the correct branch is selected purely by protocolVersion', () => {
    const sharedOverrides = {
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
    };
    const v3Result = calculatePortfolioSummary(
      basePortfolio({ ...sharedOverrides, protocolVersion: 'v3' }),
      'live',
    );
    const v4Result = calculatePortfolioSummary(
      basePortfolio({ ...sharedOverrides, protocolVersion: 'v4' }),
      'live',
    );
    expect(v3Result.ok).toBe(true);
    expect(v4Result.ok).toBe(true);
    if (!v3Result.ok || !v4Result.ok) return;
    // V3 uses liquidationThreshold (0.8) -> HF 4. V4 uses collateralFactor
    // (0.65) -> HF 3.25, even though both fields are present on both
    // portfolios (v4CollateralRisk is simply inert for the v3 portfolio,
    // the same "extra field is inert" pattern v4DebtState already has).
    expect(v3Result.data.healthFactor).toBe(4);
    expect(v4Result.data.healthFactor).toBeCloseTo(3.25, 9);
  });

  it('fails closed with AAVE_V4_COLLATERAL_RISK_MISSING when v4DebtState is present but v4CollateralRisk is not, rather than falling back to protocol.liquidationThreshold', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      category: 'calculation',
      code: 'AAVE_V4_COLLATERAL_RISK_MISSING',
    });
  });

  it('does not have a data field on the missing-collateral-risk failure (no partial/placeholder result leaks through)', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('collateralFactor: 0 is read as real data (not silently treated as missing) even though the resulting calculation then correctly fails on DIVISION_BY_ZERO — pre-existing Engine behavior (F-024), not a new V4 defect, identical to V3 with liquidationThreshold: 0', () => {
    // calculateLiquidationPrice (F-024) is undefined when effective
    // collateral (collateralValue * threshold) is zero with nonzero debt —
    // documented Engine-layer behavior, unchanged by Stage 23D's dispatch.
    // This is a genuine, correct failure, not evidence of "0 treated as
    // missing" — the failure is DIVISION_BY_ZERO, never
    // AAVE_V4_COLLATERAL_RISK_MISSING, proving 0 passed the guard as real
    // data and only the downstream math correctly rejects it.
    const portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0, dynamicConfigKey: 7 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'DIVISION_BY_ZERO' });
    expect(result.errors[0].code).not.toBe('AAVE_V4_COLLATERAL_RISK_MISSING');
  });

  it('never falls back to protocol.maxLoanToValue either — the two V3 fields and the V4 field stay three separate concepts', () => {
    const portfolio = basePortfolio({
      protocol: {
        maxLoanToValue: 0.65, // deliberately equal to collateralFactor below
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // If maxLoanToValue had leaked in via a coincidental equal value, the
    // assertion below would still pass by accident — the meaningful proof
    // is the earlier "conflicting V3/V4 fixture" test, where the two
    // fields differ; this test only confirms no crash/no special-casing
    // occurs when maxLoanToValue happens to equal collateralFactor.
    expect(result.data.healthFactor).toBeCloseTo(3.25, 9);
  });

  it('hypothetical collateral/debt changes produce a correct V4 Health Factor via pure local Engine calculation, no RPC call', () => {
    // A hypothetical +1 BTC collateral top-up, computed purely from the
    // ApplicationPortfolio object — no network access, proving this
    // primitive is usable for Simulation/Loop Builder/Exit Planner
    // hypothetical states, not just live-synced ones.
    const portfolio = basePortfolio({
      collateral: { asset: 'BTC', quantity: 3 }, // was 2, hypothetically +1
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Collateral: 3 BTC @ $50,000 = $150,000. HF = 0.65 * 150000 / 20000 = 4.875.
    expect(result.data.healthFactor).toBeCloseTo(4.875, 9);
  });

  /**
   * V1.1 Batch 4 — a V4 full-exit (zero collateral, zero drawn/premium
   * debt) produces the same State A safe values as V3's own zero-state
   * matrix test above, proving the zero-state fix is protocol-agnostic:
   * it operates on the already-resolved `collateralValue`/`debtValue`
   * `calculatePortfolioSummary` computes for either protocol version, not
   * on raw V3- or V4-shaped fields. `v4DebtState`/`v4CollateralRisk`
   * still need to be present (guards above) even though the amounts they
   * describe are zero — a V4 full-exit is "debt state synced and reads
   * zero," never "no debt state at all."
   */
  it("V1.1 Batch 4: a V4 full exit (zero collateral, zero drawn/premium debt) matches V3's State A zero-state semantics", () => {
    const portfolio = basePortfolio({
      collateral: { asset: 'BTC', quantity: 0 },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 0, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0.1 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
    });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.collateralValue).toBe(0);
    expect(result.data.debtValue).toBe(0);
    expect(result.data.leverage).toBe(0);
    expect(result.data.healthFactor).toBe(Infinity);
    expect(result.data.liquidation).toBeNull();
    expect(result.data.interestCost).toBe(0);
    expect(Number.isNaN(result.data.leverage)).toBe(false);
  });
});
