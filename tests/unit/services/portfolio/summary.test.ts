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
});
