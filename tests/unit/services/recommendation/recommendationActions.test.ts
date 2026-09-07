import { describe, expect, it } from 'vitest';

import { deriveAaveV4EffectiveBorrowRate } from '@/services/portfolio/mapping';
import { calculateRecommendationActions } from '@/services/recommendation/recommendationActions';
import { calculateTargetHealthFactorActions } from '@/services/recommendation/targetHealthFactorActions';
import type { Portfolio } from '@/types/portfolio';

/**
 * `calculateRecommendationActions` — v1.18.0 Batch 2, resolving Conflict
 * #29's preference-source gap per
 * `docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md` §6.1. Same base
 * portfolio numbers as `targetHealthFactorActions.test.ts`/
 * `recommendations.test.ts`, so figures are directly cross-checkable
 * against those already-established, already-verified worked examples.
 */
function basePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const FULL_BORROW_PREFS = { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 };
const FULL_LOOP_PREFS = { loopBorrowPercentage: 0.5, maxAcceptableAnnualInterestCost: 5000 };

describe('calculateRecommendationActions — no target Health Factor configured (spec §5 row 1)', () => {
  it('returns all four items unavailable, with no target, when settings are entirely empty', () => {
    const result = calculateRecommendationActions(basePortfolio(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.targetHealthFactor).toBeNull();
    expect(result.data.items).toEqual({});
    expect(result.data.unavailableReasons.repayment).toBeDefined();
    expect(result.data.unavailableReasons.additionalCollateral).toBeDefined();
    expect(result.data.unavailableReasons.borrow).toBeDefined();
    expect(result.data.unavailableReasons.loop).toBeDefined();
  });

  it('still returns real, honest ServiceMetadata (not a fabricated engineVersion/formulaVersion) even though no recommendation is computed', () => {
    const result = calculateRecommendationActions(basePortfolio(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.engineVersion.length).toBeGreaterThan(0);
    expect(result.metadata.formulaVersion.length).toBeGreaterThan(0);
  });

  it('stays unavailable for all four even when Borrow/Loop preferences ARE fully configured but targetHealthFactor is not (spec §6.1 step 1 — a whole-function gate)', () => {
    const result = calculateRecommendationActions(
      basePortfolio({
        settings: {
          recommendationPreferences: { borrow: FULL_BORROW_PREFS, loop: FULL_LOOP_PREFS },
        },
      }),
      'manual',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toEqual({});
  });
});

/**
 * Scenario A — no `recommendationPreferences` at all: Repayment/Additional
 * Collateral must behave identically to the already-shipped
 * `calculateTargetHealthFactorActions` path, proving zero regression.
 */
describe('calculateRecommendationActions — Scenario A: no recommendationPreferences, F-062/F-063 identical to the shipped path', () => {
  it('matches calculateTargetHealthFactorActions exactly for repayment and additionalCollateral', () => {
    const portfolio = basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 5 } } });
    const result = calculateRecommendationActions(portfolio, 'manual');
    const shipped = calculateTargetHealthFactorActions(portfolio, 5, 'manual');
    expect(result.ok).toBe(true);
    expect(shipped.ok).toBe(true);
    if (!result.ok || !shipped.ok) return;
    expect(result.data.items.repayment).toEqual(shipped.data.repayment);
    expect(result.data.items.additionalCollateral).toEqual(shipped.data.additionalCollateral);
  });

  it('Borrow and Loop are both absent, each with its own real reason', () => {
    const portfolio = basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 5 } } });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.borrow).toBeUndefined();
    expect(result.data.items.loop).toBeUndefined();
    expect(result.data.unavailableReasons.borrow).toBeDefined();
    expect(result.data.unavailableReasons.loop).toBeDefined();
  });
});

/**
 * Scenarios B/C — Borrow's own availability, independent of Loop.
 */
describe('calculateRecommendationActions — Scenarios B/C: Borrow full vs. partial configuration', () => {
  it('B: full Borrow config adds F-061 to items', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { borrow: FULL_BORROW_PREFS },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.borrow).toBeDefined();
    expect(result.data.items.borrow?.category).toBe('debtManagement');
    expect(result.data.items.borrow?.formulaReferences).toContain('F-061');
    expect(result.data.unavailableReasons.borrow).toBeUndefined();
  });

  it('C: only userMinHealthFactor set (targetDebtRatio missing) — Borrow stays absent', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { borrow: { userMinHealthFactor: 1.5 } },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.borrow).toBeUndefined();
    expect(result.data.unavailableReasons.borrow).toBeDefined();
  });

  it('C: only targetDebtRatio set (userMinHealthFactor missing) — Borrow stays absent', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { borrow: { targetDebtRatio: 0.5 } },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.borrow).toBeUndefined();
  });
});

/**
 * Scenarios D/E — Loop's own availability, independent of Borrow.
 */
describe('calculateRecommendationActions — Scenarios D/E: Loop full vs. partial configuration', () => {
  it('D: full Loop config adds F-064 to items', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 1.2 },
        recommendationPreferences: { loop: FULL_LOOP_PREFS },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.loop).toBeDefined();
    expect(result.data.items.loop?.category).toBe('leverage');
    expect(result.data.items.loop?.formulaReferences).toContain('F-064');
    expect(result.data.unavailableReasons.loop).toBeUndefined();
  });

  it('E: only loopBorrowPercentage set (maxAcceptableAnnualInterestCost missing) — Loop stays absent', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 1.2 },
        recommendationPreferences: { loop: { loopBorrowPercentage: 0.5 } },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.loop).toBeUndefined();
    expect(result.data.unavailableReasons.loop).toBeDefined();
  });

  it('E: only maxAcceptableAnnualInterestCost set (loopBorrowPercentage missing) — Loop stays absent', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 1.2 },
        recommendationPreferences: { loop: { maxAcceptableAnnualInterestCost: 5000 } },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.loop).toBeUndefined();
  });
});

/**
 * Scenario F — both Borrow and Loop fully configured: all four items
 * independently computed. Scenarios G/H — one complete, one incomplete,
 * proving true independence (spec §5's full table).
 */
describe('calculateRecommendationActions — Scenario F: both fully configured, all four independently computed', () => {
  it('produces all four items when everything is configured', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 1.2 },
        recommendationPreferences: { borrow: FULL_BORROW_PREFS, loop: FULL_LOOP_PREFS },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.data.items).sort()).toEqual([
      'additionalCollateral',
      'borrow',
      'loop',
      'repayment',
    ]);
    expect(result.data.unavailableReasons).toEqual({});
  });
});

describe('calculateRecommendationActions — Scenarios G/H: one rule complete, the other incomplete (independence)', () => {
  it('G: Borrow complete / Loop incomplete — Borrow present, Loop absent, Repayment/Additional Collateral unaffected', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: {
          borrow: FULL_BORROW_PREFS,
          loop: { loopBorrowPercentage: 0.5 },
        },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.borrow).toBeDefined();
    expect(result.data.items.loop).toBeUndefined();
    expect(result.data.items.repayment).toBeDefined();
    expect(result.data.items.additionalCollateral).toBeDefined();
    expect(result.data.unavailableReasons.loop).toBeDefined();
    expect(result.data.unavailableReasons.borrow).toBeUndefined();
  });

  it('H: Loop complete / Borrow incomplete — Loop present, Borrow absent, Repayment/Additional Collateral unaffected', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 1.2 },
        recommendationPreferences: {
          borrow: { targetDebtRatio: 0.5 },
          loop: FULL_LOOP_PREFS,
        },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.loop).toBeDefined();
    expect(result.data.items.borrow).toBeUndefined();
    expect(result.data.items.repayment).toBeDefined();
    expect(result.data.items.additionalCollateral).toBeDefined();
    expect(result.data.unavailableReasons.borrow).toBeDefined();
    expect(result.data.unavailableReasons.loop).toBeUndefined();
  });
});

/**
 * Scenario I — a value that should never reach this function because
 * Batch 1's schema already rejects it at the persistence boundary, but is
 * checked here as defense-in-depth: an out-of-range preference must not
 * "sneak through" and silently produce a placeholder/garbage
 * recommendation. The Engine's own validation (unmodified) must still
 * fail the whole call closed.
 */
describe('calculateRecommendationActions — Scenario I: an invalid preference value cannot sneak through', () => {
  it('fails closed (never a partial/placeholder result) for a non-positive userMinHealthFactor that bypassed schema validation', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { borrow: { userMinHealthFactor: -1, targetDebtRatio: 0.5 } },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('fails closed for an out-of-range targetDebtRatio that bypassed schema validation', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 5 },
        recommendationPreferences: { borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 1.5 } },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(false);
  });

  it('fails closed for a non-positive maxAcceptableAnnualInterestCost that bypassed schema validation', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 1.2 },
        recommendationPreferences: {
          loop: { loopBorrowPercentage: 0.5, maxAcceptableAnnualInterestCost: 0 },
        },
      },
    });
    const result = calculateRecommendationActions(portfolio, 'manual');
    expect(result.ok).toBe(false);
  });
});

/**
 * Scenario J — V3 parity: behaves identically to the general case, no
 * V3-specific logic exists or is needed.
 */
describe('calculateRecommendationActions — Scenario J: V3 parity', () => {
  it('an explicit protocolVersion: "v3" behaves identically to an unset protocolVersion', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v3',
      settings: {
        safetyTargets: { targetHealthFactor: 1.2 },
        recommendationPreferences: { borrow: FULL_BORROW_PREFS, loop: FULL_LOOP_PREFS },
      },
    });
    const unsetResult = calculateRecommendationActions(
      { ...portfolio, protocolVersion: undefined },
      'manual',
    );
    const v3Result = calculateRecommendationActions(portfolio, 'manual');
    expect(unsetResult.ok).toBe(true);
    expect(v3Result.ok).toBe(true);
    if (!unsetResult.ok || !v3Result.ok) return;
    expect(v3Result.data.items).toEqual(unsetResult.data.items);
  });
});

/**
 * Scenarios K/L — V4 parity and V4 dispatch. `collateralFactor: 0.65` is
 * deliberately chosen to differ from `protocol.liquidationThreshold: 0.8`/
 * `maxLoanToValue: 0.75` in `basePortfolio()`, so a test that silently
 * used a V3 field would fail on an exact numeric mismatch — the same
 * fixture-design precedent `recommendations.test.ts`/
 * `targetHealthFactorActions.test.ts` already establish.
 */
describe('calculateRecommendationActions — Scenarios K/L: V4 parity and V4 dispatch reuse', () => {
  function v4Portfolio(overrides: Partial<Portfolio> = {}): Portfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
      ...overrides,
    });
  }

  it('K: fails with AAVE_V4_DEBT_STATE_MISSING for a "v4" portfolio with no synced v4DebtState', () => {
    const result = calculateRecommendationActions(
      basePortfolio({
        protocolVersion: 'v4',
        settings: { safetyTargets: { targetHealthFactor: 5 } },
      }),
      'manual',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('K: fails with AAVE_V4_COLLATERAL_RISK_MISSING when v4DebtState is present but v4CollateralRisk is not', () => {
    const result = calculateRecommendationActions(
      v4Portfolio({
        v4CollateralRisk: undefined,
        settings: { safetyTargets: { targetHealthFactor: 5 } },
      }),
      'manual',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_COLLATERAL_RISK_MISSING' });
  });

  it('K: succeeds and produces all four items once V4 state is fully synced and preferences configured', () => {
    const result = calculateRecommendationActions(
      v4Portfolio({
        settings: {
          safetyTargets: { targetHealthFactor: 5 },
          recommendationPreferences: { borrow: FULL_BORROW_PREFS, loop: FULL_LOOP_PREFS },
        },
      }),
      'manual',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Object.keys(result.data.items).sort()).toEqual([
      'additionalCollateral',
      'borrow',
      'loop',
      'repayment',
    ]);
  });

  it('L: Borrow/Repayment dispatch collateralFactor (0.65), not protocol.liquidationThreshold (0.8) — exact numeric proof', () => {
    // Collateral: 2 BTC @ $50,000 = $100,000. Debt: $20,000.
    // collateralFactor: 0.65. targetHealthFactor: 5.
    // Target Debt (F-040) = 100000 * 0.65 / 5 = 13000.
    // Required repayment = 20000 - 13000 = 7000 (matches
    // targetHealthFactorActions.test.ts's own identical V4 dispatch fixture).
    const result = calculateRecommendationActions(
      v4Portfolio({
        settings: {
          safetyTargets: { targetHealthFactor: 5 },
          recommendationPreferences: { borrow: FULL_BORROW_PREFS },
        },
      }),
      'manual',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items.repayment?.relevantValues.requiredRepayment).toBeCloseTo(7000, 6);
    expect(result.data.items.repayment?.relevantValues.requiredRepayment).not.toBeCloseTo(4000, 6);
  });

  it('L: Loop uses the real derived V4 effective borrow rate, not the legacy protocol.borrowApr, for its interest-cost check', () => {
    const v4DebtState = {
      drawnDebt: 20000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
    };
    const rateStep = deriveAaveV4EffectiveBorrowRate(v4DebtState, null, 'live');
    expect(rateStep.ok).toBe(true);
    if (!rateStep.ok) return;
    // Same Stage 10/15 regression vector as recommendations.test.ts: ≈5.37%, not 5%.
    expect(rateStep.value).toBeCloseTo(0.05365853658536585, 10);

    const v4Result = calculateRecommendationActions(
      basePortfolio({
        protocolVersion: 'v4',
        v4DebtState,
        // Matches basePortfolio().protocol.maxLoanToValue (0.75) — same
        // "isolate borrowedAmount from the rate dispatch" precedent
        // recommendations.test.ts's own Stage 15 test uses.
        v4CollateralRisk: { collateralFactor: 0.75, dynamicConfigKey: 1 },
        settings: {
          safetyTargets: { targetHealthFactor: 1.2 },
          recommendationPreferences: { loop: FULL_LOOP_PREFS },
        },
      }),
      'live',
    );
    expect(v4Result.ok).toBe(true);
    if (!v4Result.ok) return;

    const v3EquivalentResult = calculateRecommendationActions(
      basePortfolio({
        debt: { asset: 'USDC', balance: 20500 },
        protocol: { ...basePortfolio().protocol, borrowApr: rateStep.value },
        settings: {
          safetyTargets: { targetHealthFactor: 1.2 },
          recommendationPreferences: { loop: FULL_LOOP_PREFS },
        },
      }),
      'live',
    );
    expect(v3EquivalentResult.ok).toBe(true);
    if (!v3EquivalentResult.ok) return;

    expect(v4Result.data.items.loop?.relevantValues.annualInterestCost).toBeCloseTo(
      v3EquivalentResult.data.items.loop?.relevantValues.annualInterestCost ?? NaN,
      6,
    );

    const legacyRateResult = calculateRecommendationActions(
      basePortfolio({
        debt: { asset: 'USDC', balance: 20500 },
        settings: {
          safetyTargets: { targetHealthFactor: 1.2 },
          recommendationPreferences: { loop: FULL_LOOP_PREFS },
        },
      }),
      'live',
    );
    expect(legacyRateResult.ok).toBe(true);
    if (!legacyRateResult.ok) return;

    expect(v4Result.data.items.loop?.relevantValues.annualInterestCost).not.toBeCloseTo(
      legacyRateResult.data.items.loop?.relevantValues.annualInterestCost ?? NaN,
      2,
    );
  });
});
