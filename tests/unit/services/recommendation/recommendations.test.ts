import { describe, expect, it } from 'vitest';

import type { RecommendationRuleConfig } from '@/engine';
import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { generateRecommendationSet } from '@/services/recommendation/recommendations';

/**
 * Recommendation Service — 06_TASKS.md M3-012.
 *
 * `generateRecommendations` (M2-025/M2-026) always returns exactly 4
 * recommendations (one per implemented rule: borrow, repayment,
 * additional collateral, loop) — the Service's own value-add is
 * priority-ranking them and passing through `unavailableCategories`,
 * which is what these tests focus on rather than re-verifying each
 * individual rule's own trigger logic (already covered by Milestone 2's
 * tests).
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

function baseRules(): RecommendationRuleConfig {
  return {
    borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 },
    repayment: { targetHealthFactor: 1.5 },
    additionalCollateral: { targetHealthFactor: 1.5 },
    loop: {
      targetHealthFactor: 1.5,
      loopBorrowPercentage: 0.5,
      maxAcceptableAnnualInterestCost: 5000,
    },
  };
}

const DECISION_PRIORITY_ORDER = [
  'Prevent Liquidation',
  'Maintain Target Health Factor',
  'Reduce Interest Costs',
  'Improve Capital Efficiency',
  'Achieve User Goals',
];

describe('generateRecommendationSet (M3-012)', () => {
  it('returns exactly 4 recommendations (one per implemented rule), each ranked 1-4', () => {
    const result = generateRecommendationSet(basePortfolio(), baseRules(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recommendations).toHaveLength(4);
    const priorities = result.data.recommendations.map((r) => r.priority).sort((a, b) => a - b);
    expect(priorities).toEqual([1, 2, 3, 4]);
  });

  it('orders recommendations by the documented Decision Priority tier, not original array position', () => {
    const result = generateRecommendationSet(basePortfolio(), baseRules(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tierIndices = result.data.recommendations.map((r) =>
      DECISION_PRIORITY_ORDER.indexOf(r.decisionPriority),
    );
    for (let i = 1; i < tierIndices.length; i++) {
      expect(tierIndices[i]).toBeGreaterThanOrEqual(tierIndices[i - 1]);
    }
  });

  it('every recommendation carries all M3-012 "Include" fields', () => {
    const result = generateRecommendationSet(basePortfolio(), baseRules(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const recommendation of result.data.recommendations) {
      expect(typeof recommendation.priority).toBe('number');
      expect(typeof recommendation.category).toBe('string');
      expect(typeof recommendation.decisionPriority).toBe('string');
      expect(typeof recommendation.triggeringCondition).toBe('string');
      expect(typeof recommendation.suggestedAction).toBe('string');
      expect(typeof recommendation.expectedEffect).toBe('string');
      expect(Array.isArray(recommendation.formulaReferences)).toBe(true);
      expect(recommendation.formulaReferences.length).toBeGreaterThan(0);
    }
  });

  it('preserves unavailableCategories rather than dropping them', () => {
    const result = generateRecommendationSet(basePortfolio(), baseRules(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const categories = result.data.unavailableCategories.map((c) => c.category);
    expect(categories).toContain('safety');
    expect(categories).toContain('interestCost');
    expect(categories).toContain('exitReadiness');
  });

  it('threads sourceStatus through to metadata', () => {
    const result = generateRecommendationSet(basePortfolio(), baseRules(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sourceStatus).toBe('manual');
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...basePortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    const result = generateRecommendationSet(invalidPortfolio, baseRules(), 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('does not have an errors field on a success result (discriminated union, not a nullable envelope)', () => {
    const result = generateRecommendationSet(basePortfolio(), baseRules(), 'live');
    expect(result.ok).toBe(true);
    expect('errors' in result).toBe(false);
  });

  it('propagates an Engine failure as a single ApplicationError', () => {
    const invalidRules: RecommendationRuleConfig = {
      ...baseRules(),
      borrow: { userMinHealthFactor: -1, targetDebtRatio: 0.5 },
    };
    const result = generateRecommendationSet(basePortfolio(), invalidRules, 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].category).toBe('calculation');
  });
});

/**
 * V4 fail-closed guard — V4 Readiness Audit §12 Stage 10.
 * `generateRecommendations` reads debt throughout, so a V4 portfolio with
 * no synced `v4DebtState` must fail closed rather than silently returning
 * recommendations computed from stale legacy `debt.balance`.
 */
describe('generateRecommendationSet — V4 fail-closed guard (Stage 10)', () => {
  it('fails with AAVE_V4_DEBT_STATE_MISSING for a "v4" portfolio with no synced v4DebtState', () => {
    const result = generateRecommendationSet(
      { ...basePortfolio(), protocolVersion: 'v4' },
      baseRules(),
      'live',
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
  });

  it('does not have a data field on the missing-state failure (no partial/placeholder result leaks through)', () => {
    const result = generateRecommendationSet(
      { ...basePortfolio(), protocolVersion: 'v4' },
      baseRules(),
      'live',
    );
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('succeeds once v4DebtState is synced', () => {
    const result = generateRecommendationSet(
      {
        ...basePortfolio(),
        protocolVersion: 'v4',
        v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      },
      baseRules(),
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recommendations).toHaveLength(4);
  });

  it('never fails for a "v3" (or unset) portfolio, even when v4DebtState happens to be present (no cross-inference)', () => {
    const result = generateRecommendationSet(
      {
        ...basePortfolio(),
        v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      },
      baseRules(),
      'live',
    );
    expect(result.ok).toBe(true);
  });
});
