import { describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { calculateTargetHealthFactorActions } from '@/services/recommendation/targetHealthFactorActions';

/**
 * Target Health Factor Actions — added Milestone 5 Batch 4 to support
 * M5-007/M5-009. See this Service's own header comment for why it exists
 * separately from `generateRecommendationSet` (M3-012): it needs only
 * `targetHealthFactor`, not a full `RecommendationRuleConfig`.
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

describe('calculateTargetHealthFactorActions (Batch 4)', () => {
  it('returns both a repayment and an additional-collateral recommendation for a below-target portfolio', () => {
    // Current HF = (100000 * 0.8) / 20000 = 4. Target above that (5) requires action.
    const result = calculateTargetHealthFactorActions(basePortfolio(), 5, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.targetHealthFactor).toBe(5);
    expect(result.data.repayment.relevantValues.requiredRepayment).toBeGreaterThan(0);
    expect(result.data.additionalCollateral.relevantValues.requiredUsd).toBeGreaterThan(0);
    expect(result.data.repayment.suggestedAction).not.toBe('No repayment needed.');
  });

  it('reports "no action needed" for both when the target is already met', () => {
    // Current HF = 4; a target of 1 is already exceeded.
    const result = calculateTargetHealthFactorActions(basePortfolio(), 1, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.repayment.suggestedAction).toBe('No repayment needed.');
    expect(result.data.additionalCollateral.suggestedAction).toBe(
      'No additional collateral needed.',
    );
  });

  it('uses only {portfolio, targetHealthFactor} — no other invented threshold is required to call it', () => {
    // The type signature itself is the proof: this call compiles with
    // nothing beyond portfolio + one number + sourceStatus.
    const result = calculateTargetHealthFactorActions(basePortfolio(), 1.5, 'manual');
    expect(result.ok).toBe(true);
  });

  it('fails as one unit, matching calculatePortfolioSummary’s own fail-fast convention', () => {
    const result = calculateTargetHealthFactorActions(basePortfolio(), -1, 'manual');
    expect(result.ok).toBe(false);
  });
});

/**
 * V4 fail-closed guard — V4 Readiness Audit §12 Stage 10. Both
 * recommendations read debt (via `engineInput`), so a V4 portfolio with
 * no synced `v4DebtState` must fail closed rather than silently
 * recommending an amount computed from stale legacy `debt.balance`.
 */
describe('calculateTargetHealthFactorActions — V4 fail-closed guard (Stage 10)', () => {
  it('fails with AAVE_V4_DEBT_STATE_MISSING for a "v4" portfolio with no synced v4DebtState', () => {
    const result = calculateTargetHealthFactorActions(
      { ...basePortfolio(), protocolVersion: 'v4' },
      5,
      'manual',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('succeeds once v4DebtState is synced', () => {
    const result = calculateTargetHealthFactorActions(
      {
        ...basePortfolio(),
        protocolVersion: 'v4',
        v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
        // Stage 23E's collateral-risk guard now requires this on every V4
        // portfolio, in addition to v4DebtState.
        v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
      },
      5,
      'manual',
    );
    expect(result.ok).toBe(true);
  });

  it('never fails for a "v3" (or unset) portfolio, even when v4DebtState happens to be present (no cross-inference)', () => {
    const result = calculateTargetHealthFactorActions(
      {
        ...basePortfolio(),
        v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      },
      5,
      'manual',
    );
    expect(result.ok).toBe(true);
  });
});

/**
 * V4 risk-capacity dispatch — V4 Readiness Audit §12 Stage 23E. Both
 * `calculateRepaymentRecommendation` (F-062) and
 * `calculateAdditionalCollateralRecommendation` (F-063) read
 * `portfolio.protocol.liquidationThreshold` directly, a V3-shaped
 * assumption Stage 23D didn't reach. `collateralFactor: 0.65` is
 * deliberately chosen to differ from every fixture's
 * `protocol.liquidationThreshold: 0.8` in this file, so a test that
 * silently used the V3 field would fail on an exact numeric mismatch.
 */
describe('calculateTargetHealthFactorActions — V4 risk-capacity dispatch (Stage 23E)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return {
      ...basePortfolio(),
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
      ...overrides,
    };
  }

  it('computes both recommendations from collateralFactor, not protocol.liquidationThreshold — numerical fixture from the authoritative F-040/F-063 formulas', () => {
    // Collateral: 2 BTC @ $50,000 = $100,000. Debt: $20,000.
    // collateralFactor: 0.65. targetHealthFactor: 3.25.
    // Target Debt (F-040) = 100000 * 0.65 / 3.25 = 20000 -> already at
    // target, so no repayment/additional collateral needed. Pick a
    // higher target instead to force a real, checkable action.
    const result = calculateTargetHealthFactorActions(v4Portfolio(), 5, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Target Debt = 100000 * 0.65 / 5 = 13000. Required repayment =
    // 20000 - 13000 = 7000.
    expect(result.data.repayment.relevantValues.requiredRepayment).toBeCloseTo(7000, 6);
    // Target Collateral Value = (5 * 20000) / 0.65 = 153846.153846...
    // Required additional = 153846.153846... - 100000 = 53846.153846...
    expect(result.data.additionalCollateral.relevantValues.requiredUsd).toBeCloseTo(
      53846.15384615385,
      4,
    );
    // If this had silently used protocol.liquidationThreshold (0.8), the
    // required repayment would be 100000*0.8/5 = 16000 -> 4000, not 7000.
    expect(result.data.repayment.relevantValues.requiredRepayment).not.toBeCloseTo(4000, 6);
  });

  it('a deliberately conflicting V3/V4 fixture on the same portfolio shape proves the correct branch is selected purely by protocolVersion', () => {
    const v3Result = calculateTargetHealthFactorActions(
      v4Portfolio({ protocolVersion: 'v3' }),
      5,
      'manual',
    );
    const v4Result = calculateTargetHealthFactorActions(v4Portfolio(), 5, 'manual');
    expect(v3Result.ok).toBe(true);
    expect(v4Result.ok).toBe(true);
    if (!v3Result.ok || !v4Result.ok) return;
    // V3: target debt = 100000*0.8/5 = 16000 -> repayment 4000.
    expect(v3Result.data.repayment.relevantValues.requiredRepayment).toBeCloseTo(4000, 6);
    // V4: target debt = 100000*0.65/5 = 13000 -> repayment 7000.
    expect(v4Result.data.repayment.relevantValues.requiredRepayment).toBeCloseTo(7000, 6);
  });

  it('fails closed with AAVE_V4_COLLATERAL_RISK_MISSING when v4DebtState is present but v4CollateralRisk is not, never falling back to protocol.liquidationThreshold', () => {
    const result = calculateTargetHealthFactorActions(
      v4Portfolio({ v4CollateralRisk: undefined }),
      5,
      'manual',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_COLLATERAL_RISK_MISSING' });
  });

  it('does not have a data field on the missing-collateral-risk failure (no partial/placeholder result leaks through)', () => {
    const result = calculateTargetHealthFactorActions(
      v4Portfolio({ v4CollateralRisk: undefined }),
      5,
      'manual',
    );
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('hypothetical collateral/debt changes produce correct V4 recommendations via pure local Engine calculation, no RPC call', () => {
    const portfolio = v4Portfolio({ collateral: { asset: 'BTC', quantity: 3 } });
    const result = calculateTargetHealthFactorActions(portfolio, 5, 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Collateral: 3 BTC @ $50,000 = $150,000. Target Debt = 150000*0.65/5
    // = 19500. Required repayment = 20000 - 19500 = 500.
    expect(result.data.repayment.relevantValues.requiredRepayment).toBeCloseTo(500, 6);
  });
});
