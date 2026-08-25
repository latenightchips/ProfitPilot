import { describe, expect, it } from 'vitest';

import type { LoopStrategySettings } from '@/services/loop/strategy';
import { planLoopStrategy } from '@/services/loop/strategy';
import { deriveAaveV4EffectiveBorrowRate } from '@/services/portfolio/mapping';
import type { ApplicationPortfolio } from '@/services/portfolio/models';

/**
 * Loop Strategy Service — 06_TASKS.md M3-010.
 *
 * Revisits conflict #8 (no documented swap-fee/slippage/gas-estimate
 * formula): `calculateLoopCosts` already itemizes those as `unavailable`
 * with reasons rather than fabricating a cost model — these tests verify
 * that itemization is passed through unchanged, not re-verify Milestone
 * 2's own step-by-step loop math (already covered by
 * `tests/unit/engine/loop/`).
 */
function healthyPortfolio(): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  };
}

function healthySettings(): LoopStrategySettings {
  return { targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 };
}

describe('planLoopStrategy (M3-010)', () => {
  it('returns a viable strategy with at least one step and computed costs', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(true);
    expect(result.data.strategy).not.toBeNull();
    expect(result.data.strategy?.steps.length).toBeGreaterThan(0);
    expect(result.data.costs).not.toBeNull();
  });

  it('returns a real, positive btcExposure for a viable strategy (M7-011)', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.btcExposure).not.toBeNull();
    expect(result.data.btcExposure).toBeGreaterThan(0);
  });

  it('returns a null btcExposure alongside a null strategy for a non-viable result', () => {
    const atLiquidation: ApplicationPortfolio = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 9000 },
      market: { btcPriceUsd: 10000 },
      protocol: {
        maxLoanToValue: 0.5,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = planLoopStrategy(atLiquidation, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.btcExposure).toBeNull();
  });

  it('itemizes swap fees, slippage, gas estimate, and total cost as unavailable when no execution-cost assumptions are configured (conflict #8, P1-6 backward compatibility)', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const items = result.data.costs?.items.map((entry) => entry.item);
    expect(items).toEqual(
      expect.arrayContaining(['swapFees', 'slippage', 'gasEstimate', 'totalImplementationCost']),
    );
    expect(result.data.costs?.items).toHaveLength(4);
    for (const entry of result.data.costs?.items ?? []) {
      expect(entry.amountUsd).toBeNull();
    }
  });

  it('computes borrowing interest and break-even appreciation (the documented, computable cost fields)', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.data.costs?.borrowingInterest).toBe('number');
    expect(typeof result.data.costs?.breakEvenAppreciation).toBe('number');
  });

  it('reports non-viable with an error finding when the starting position is already at liquidation', () => {
    const atLiquidation: ApplicationPortfolio = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 9000 },
      market: { btcPriceUsd: 10000 },
      protocol: {
        maxLoanToValue: 0.5,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = planLoopStrategy(atLiquidation, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(false);
    expect(result.data.strategy).toBeNull();
    expect(result.data.costs).toBeNull();
    expect(result.data.findings).toContainEqual(
      expect.objectContaining({ check: 'LIQUIDATION_PROXIMITY', severity: 'error' }),
    );
  });

  it('reports non-viable when the configured minHealthFactor is at or below the liquidation boundary', () => {
    const invalidSettings: LoopStrategySettings = { ...healthySettings(), minHealthFactor: 1 };
    const result = planLoopStrategy(healthyPortfolio(), invalidSettings, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(false);
    expect(result.data.findings).toContainEqual(
      expect.objectContaining({ check: 'MINIMUM_HEALTH_FACTOR', severity: 'error' }),
    );
  });

  it('threads sourceStatus through to metadata', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sourceStatus).toBe('manual');
  });

  it('reports non-viable (not an Engine failure) for invalid protocol parameters — validateLoopStrategySafety carries this as data', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...healthyPortfolio(),
      protocol: {
        maxLoanToValue: 0.9,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = planLoopStrategy(invalidPortfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(false);
    expect(result.data.findings).toContainEqual(
      expect.objectContaining({ check: 'VALID_PROTOCOL_PARAMETERS', severity: 'error' }),
    );
  });

  it('propagates a genuine Engine failure for malformed input (negative collateral quantity)', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...healthyPortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    const result = planLoopStrategy(invalidPortfolio, healthySettings(), 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'INVALID_NON_NEGATIVE' });
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...healthyPortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    const result = planLoopStrategy(invalidPortfolio, healthySettings(), 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('does not have an errors field on a success result (discriminated union, not a nullable envelope)', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    expect('errors' in result).toBe(false);
  });
});

/**
 * `maxLoanToValueOverride`/`borrowAprOverride` — Milestone 7 Batch 2
 * (M7-008, "Implement Loop Strategy Controls"). Zero Engine changes;
 * these tests confirm the Service-layer substitution actually reaches
 * both the safety validation and the cost calculation, not just one.
 */
describe('planLoopStrategy — protocol overrides (M7-008)', () => {
  it('uses the real portfolio borrowApr for costs when no override is supplied', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;
    const expectedInterest = result.data.strategy.finalDebt * 0.05;
    expect(result.data.costs?.borrowingInterest).toBeCloseTo(expectedInterest, 5);
  });

  it('uses borrowAprOverride for cost calculation instead of the real portfolio rate', () => {
    const settings: LoopStrategySettings = { ...healthySettings(), borrowAprOverride: 0.2 };
    const result = planLoopStrategy(healthyPortfolio(), settings, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;
    const expectedInterest = result.data.strategy.finalDebt * 0.2;
    expect(result.data.costs?.borrowingInterest).toBeCloseTo(expectedInterest, 5);
  });

  it('rejects an invalid maxLoanToValueOverride the same way an invalid real protocol value is rejected', () => {
    const settings: LoopStrategySettings = { ...healthySettings(), maxLoanToValueOverride: 1.5 };
    const result = planLoopStrategy(healthyPortfolio(), settings, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(false);
    expect(result.data.findings).toContainEqual(
      expect.objectContaining({ check: 'VALID_PROTOCOL_PARAMETERS', severity: 'error' }),
    );
  });

  it('a stricter maxLoanToValueOverride changes the computed strategy outcome versus the real, looser protocol value', () => {
    const unrestricted = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    const restricted = planLoopStrategy(
      healthyPortfolio(),
      { ...healthySettings(), maxLoanToValueOverride: 0.1 },
      'live',
    );
    expect(unrestricted.ok).toBe(true);
    expect(restricted.ok).toBe(true);
    if (!unrestricted.ok || !restricted.ok) return;
    // A much tighter LTV ceiling than the portfolio's own real 0.5 must
    // change the resulting stop reason or final debt — proves the
    // override reaches the actual calculation, not just validation.
    expect(restricted.data.strategy?.finalDebt).not.toEqual(unrestricted.data.strategy?.finalDebt);
  });
});

/**
 * Milestone 7 Batch 3 (M7-013 "Implement Loop Safety Analysis" / M7-014
 * "Implement Loop Cost Analysis") — `remainingBorrowCapacity` (F-013)/
 * `monthlyInterestCost` (F-031), both reused Engine functions applied
 * to the final position.
 */
describe('planLoopStrategy — remainingBorrowCapacity/monthlyInterestCost (M7-013/M7-014)', () => {
  it('computes a real remainingBorrowCapacity matching the F-013 formula against the final position', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;
    const expectedCapacity =
      result.data.strategy.finalCollateral.quantity * 50000 * 0.5 - result.data.strategy.finalDebt;
    expect(result.data.remainingBorrowCapacity).toBeCloseTo(expectedCapacity, 5);
  });

  it('computes a real monthlyInterestCost distinct from simply dividing the annual figure by 12', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;
    expect(result.data.monthlyInterestCost).not.toBeNull();
    expect(result.data.monthlyInterestCost).not.toBeCloseTo(
      (result.data.costs?.borrowingInterest ?? 0) / 12,
      2,
    );
  });

  it('uses the override-resolved protocol values for both fields, not the real portfolio values', () => {
    const settings: LoopStrategySettings = {
      ...healthySettings(),
      borrowAprOverride: 0.2,
      maxLoanToValueOverride: 0.4,
    };
    const overridden = planLoopStrategy(healthyPortfolio(), settings, 'live');
    const real = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(overridden.ok).toBe(true);
    expect(real.ok).toBe(true);
    if (!overridden.ok || !real.ok) return;
    expect(overridden.data.remainingBorrowCapacity).not.toEqual(real.data.remainingBorrowCapacity);
    expect(overridden.data.monthlyInterestCost).not.toEqual(real.data.monthlyInterestCost);
  });

  it('reports both fields as null alongside a non-viable result', () => {
    const atLiquidation: ApplicationPortfolio = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 9000 },
      market: { btcPriceUsd: 10000 },
      protocol: {
        maxLoanToValue: 0.5,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = planLoopStrategy(atLiquidation, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.remainingBorrowCapacity).toBeNull();
    expect(result.data.monthlyInterestCost).toBeNull();
  });
});

/**
 * V4 fail-closed guard — V4 Readiness Audit §12 Stage 10. This Service
 * reads debt/`protocol.borrowApr` throughout (`calculateLoopCosts`,
 * `calculateMonthlyInterest`), so a V4 portfolio with no synced
 * `v4DebtState` must fail closed rather than silently planning a loop
 * strategy against stale legacy `debt.balance`.
 */
describe('planLoopStrategy — V4 fail-closed guard (Stage 10)', () => {
  it('fails with AAVE_V4_DEBT_STATE_MISSING for a "v4" portfolio with no synced v4DebtState', () => {
    const v4Portfolio: ApplicationPortfolio = { ...healthyPortfolio(), protocolVersion: 'v4' };
    const result = planLoopStrategy(v4Portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('does not have a data field on the missing-state failure (no partial/placeholder result leaks through)', () => {
    const v4Portfolio: ApplicationPortfolio = { ...healthyPortfolio(), protocolVersion: 'v4' };
    const result = planLoopStrategy(v4Portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('succeeds normally for a "v4" portfolio once v4DebtState is synced', () => {
    const v4Portfolio: ApplicationPortfolio = {
      ...healthyPortfolio(),
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 0, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0.01 },
      // Stage 23E's collateral-risk guard now requires this on every V4
      // portfolio, in addition to v4DebtState.
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
    const result = planLoopStrategy(v4Portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(true);
  });

  /**
   * V4 Readiness Audit §12 Stage 15 — the guard above only ever proved
   * "does not fail." It never checked what `calculateLoopCosts`/
   * `calculateMonthlyInterest` actually computed, and prior to this
   * stage they silently used `engineInput.protocol.borrowApr` (the
   * legacy V3 scalar) even once the guard passed. Every assertion below
   * cross-checks against an independently-computed
   * `deriveAaveV4EffectiveBorrowRate` call, proving the real derived V4
   * rate reaches the actual cost math, not a hand-picked constant.
   */
  it('uses the real derived V4 effective rate for cost/monthly-interest — not the legacy protocol.borrowApr', () => {
    const v4DebtState = {
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    };
    const v4Portfolio: ApplicationPortfolio = {
      ...healthyPortfolio(),
      collateral: { asset: 'BTC', quantity: 2 },
      protocolVersion: 'v4',
      v4DebtState,
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
    const result = planLoopStrategy(v4Portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    const rateStep = deriveAaveV4EffectiveBorrowRate(v4DebtState, null, 'live');
    expect(rateStep.ok).toBe(true);
    if (!rateStep.ok) return;
    // Same Stage 10 regression vector: annualCost 1100 / totalDebt 20500
    // ≈ 5.37%, not the legacy portfolio.protocol.borrowApr (5%).
    expect(rateStep.value).toBeCloseTo(0.05365853658536585, 10);

    const expectedInterest = result.data.strategy.finalDebt * rateStep.value;
    expect(result.data.costs?.borrowingInterest).toBeCloseTo(expectedInterest, 5);
    expect(result.data.costs?.borrowingInterest).not.toBeCloseTo(
      result.data.strategy.finalDebt * 0.05,
      5,
    );

    const expectedMonthly = result.data.strategy.finalDebt * rateStep.value * (30 / 365);
    expect(result.data.monthlyInterestCost).toBeCloseTo(expectedMonthly, 5);
  });

  it('an explicit borrowAprOverride still wins over the derived V4 rate (a deliberate planning override)', () => {
    const v4DebtState = {
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    };
    const v4Portfolio: ApplicationPortfolio = {
      ...healthyPortfolio(),
      collateral: { asset: 'BTC', quantity: 2 },
      protocolVersion: 'v4',
      v4DebtState,
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
    const result = planLoopStrategy(
      v4Portfolio,
      { ...healthySettings(), borrowAprOverride: 0.3 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;
    const expectedInterest = result.data.strategy.finalDebt * 0.3;
    expect(result.data.costs?.borrowingInterest).toBeCloseTo(expectedInterest, 5);
  });

  it('never fails or substitutes for a "v3" (or unset) portfolio, even when v4DebtState happens to be present (no cross-inference)', () => {
    const portfolioWithStrayV4State: ApplicationPortfolio = {
      ...healthyPortfolio(),
      v4DebtState: { drawnDebt: 0, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0.01 },
    };
    const result = planLoopStrategy(portfolioWithStrayV4State, healthySettings(), 'live');
    expect(result.ok).toBe(true);
  });
});

/**
 * V4 risk-capacity dispatch — V4 Readiness Audit §12 Stage 23E.
 * `validateLoopStrategySafety` (via `calculateLoopStrategy`/
 * `calculateLoopStep`, F-014) and `calculateAvailableBorrow` (F-013, this
 * file's own `remainingBorrowCapacity` step) both read
 * `engineInput.protocol.liquidationThreshold`/`.maxLoanToValue` directly
 * — a V3-shaped assumption Stage 23D didn't reach, meaning the entirety
 * of Loop Builder's per-step Health Factor/LTV math was V3-shaped for a
 * V4 portfolio before this fix. Per Stage 23B, V4 has no separate
 * max-LTV/liquidation-threshold split, so both fields dispatch to the
 * same `collateralFactor` value. `collateralFactor: 0.65` is deliberately
 * chosen to differ from `healthyPortfolio()`'s own `maxLoanToValue: 0.5`/
 * `liquidationThreshold: 0.8`, so a test that silently used a V3 field
 * would fail on an exact numeric mismatch.
 */
describe('planLoopStrategy — V4 risk-capacity dispatch (Stage 23E)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return {
      ...healthyPortfolio(),
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 0, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
      ...overrides,
    };
  }

  it("computes remainingBorrowCapacity from collateralFactor, not maxLoanToValue — self-consistent numerical proof using the strategy's own real final position", () => {
    const result = planLoopStrategy(v4Portfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null || result.data.btcExposure === null) return;
    // remainingBorrowCapacity (F-013) = exposure (= finalCollateral value)
    // * collateralFactor - finalDebt. Reading the strategy's own real
    // finalDebt/exposure (rather than hand-simulating every loop
    // iteration) keeps this test correct regardless of exactly how many
    // loop steps ran, while still proving the risk-capacity fraction fed
    // into F-013 is collateralFactor (0.65), not maxLoanToValue (0.5).
    const expectedCapacity = result.data.btcExposure * 0.65 - result.data.strategy.finalDebt;
    expect(result.data.remainingBorrowCapacity).toBeCloseTo(expectedCapacity, 4);
  });

  it('a deliberately conflicting V3/V4 fixture on the same portfolio shape proves the correct branch is selected purely by protocolVersion — a higher V4 collateralFactor draws strictly more final debt than the V3 maxLoanToValue', () => {
    // healthyPortfolio()'s own maxLoanToValue is 0.5; collateralFactor
    // here is 0.65 (higher) — a viable V4 strategy should draw MORE debt
    // per step than the same portfolio run as V3, proving the dispatch
    // reaches the actual per-step borrow-capacity math, not just a
    // post-hoc capacity readout.
    const v3Result = planLoopStrategy(
      { ...healthyPortfolio(), v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 } },
      healthySettings(),
      'live',
    );
    const v4Result = planLoopStrategy(v4Portfolio(), healthySettings(), 'live');
    expect(v3Result.ok).toBe(true);
    expect(v4Result.ok).toBe(true);
    if (
      !v3Result.ok ||
      !v4Result.ok ||
      v3Result.data.strategy === null ||
      v4Result.data.strategy === null
    ) {
      return;
    }
    // V3 never reads v4CollateralRisk at all (inert extra field, the same
    // pattern v4DebtState already has for a v3/unset portfolio) — it
    // still uses maxLoanToValue: 0.5.
    expect(v4Result.data.strategy.finalDebt).toBeGreaterThan(v3Result.data.strategy.finalDebt);
  });

  it('fails closed with AAVE_V4_COLLATERAL_RISK_MISSING when v4DebtState is present but v4CollateralRisk is not, never falling back to protocol.liquidationThreshold/maxLoanToValue', () => {
    const result = planLoopStrategy(
      v4Portfolio({ v4CollateralRisk: undefined }),
      healthySettings(),
      'live',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_COLLATERAL_RISK_MISSING' });
  });

  it('does not have a data field on the missing-collateral-risk failure (no partial/placeholder result leaks through)', () => {
    const result = planLoopStrategy(
      v4Portfolio({ v4CollateralRisk: undefined }),
      healthySettings(),
      'live',
    );
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('an explicit maxLoanToValueOverride still wins over the dispatched collateralFactor for V4 (a deliberate planning override, applied to both the LTV and liquidation-threshold slots together)', () => {
    const overridden = planLoopStrategy(
      v4Portfolio(),
      { ...healthySettings(), maxLoanToValueOverride: 0.2 },
      'live',
    );
    const real = planLoopStrategy(v4Portfolio(), healthySettings(), 'live');
    expect(overridden.ok).toBe(true);
    expect(real.ok).toBe(true);
    if (
      !overridden.ok ||
      !real.ok ||
      overridden.data.strategy === null ||
      real.data.strategy === null
    ) {
      return;
    }
    // A much lower override (0.2, vs. the real collateralFactor 0.65)
    // must draw strictly less final debt.
    expect(overridden.data.strategy.finalDebt).toBeLessThan(real.data.strategy.finalDebt);
  });
});

/**
 * Execution-cost assumption wiring — V4 Readiness Audit §12 P1-6.
 * `planLoopStrategy`'s new trailing `executionCostAssumptions` parameter
 * (portfolio-level, per this stage's own ownership report) resolves
 * (via the shared `resolveExecutionCostAssumptions`) into the Engine's
 * `LoopExecutionCostInputs`, using the strategy's own actual
 * `finalDebt - startingDebt` as the notional and `steps.length` as the
 * transaction count.
 */
describe('planLoopStrategy — execution-cost assumption wiring (P1-6)', () => {
  it('configured swap fee/slippage produce real computed costs, matching the total borrowed across every committed step', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live', {
      swapFeeRate: 0.003,
      slippageRate: 0.005,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    const totalBorrowed = result.data.strategy.finalDebt - healthyPortfolio().debt.balance;
    const byItem = Object.fromEntries(
      (result.data.costs?.items ?? []).map((entry) => [entry.item, entry]),
    );
    expect(byItem.swapFees?.amountUsd).toBeCloseTo(totalBorrowed * 0.003, 6);
    expect(byItem.gasEstimate?.amountUsd).toBeNull();
    expect(byItem.totalImplementationCost?.amountUsd).toBeNull();
  });

  it('configured gas cost produces a real gasEstimate using one transaction per committed step', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live', {
      gasCostUsd: 10,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    const byItem = Object.fromEntries(
      (result.data.costs?.items ?? []).map((entry) => [entry.item, entry]),
    );
    expect(byItem.gasEstimate?.amountUsd).toBeCloseTo(result.data.strategy.steps.length * 10, 6);
    expect(byItem.swapFees?.amountUsd).toBeNull();
  });

  it('all three assumptions configured together produce a real totalImplementationCost', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live', {
      swapFeeRate: 0.003,
      slippageRate: 0.005,
      gasCostUsd: 10,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const totalItem = result.data.costs?.items.find(
      (entry) => entry.item === 'totalImplementationCost',
    );
    expect(totalItem?.amountUsd).not.toBeNull();
    expect(totalItem?.amountUsd).toBeGreaterThan(0);
  });

  it('omitted executionCostAssumptions reproduces the exact pre-P1-6 all-unavailable result', () => {
    const withAssumptions = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live', {
      swapFeeRate: 0.003,
      slippageRate: 0.005,
    });
    const withoutAssumptions = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(withAssumptions.ok && withoutAssumptions.ok).toBe(true);
    if (!withAssumptions.ok || !withoutAssumptions.ok) return;

    for (const entry of withoutAssumptions.data.costs?.items ?? []) {
      expect(entry.amountUsd).toBeNull();
    }
    // The strategy's own math (finalDebt/finalCollateral/finalHealthFactor)
    // is identical either way — cost reporting never feeds back into it.
    expect(withAssumptions.data.strategy?.finalDebt).toBe(
      withoutAssumptions.data.strategy?.finalDebt,
    );
    expect(withAssumptions.data.strategy?.finalCollateral.quantity).toBe(
      withoutAssumptions.data.strategy?.finalCollateral.quantity,
    );
  });
});
