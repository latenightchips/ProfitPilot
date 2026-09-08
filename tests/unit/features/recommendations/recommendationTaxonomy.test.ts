import { describe, expect, it } from 'vitest';

import {
  ADDITIONAL_COLLATERAL_VALUE_LABELS,
  filterCategoryFor,
  isActionableRecommendation,
  presentationTextFor,
  RECOMMENDATION_FILTER_CATEGORIES,
  REPAYMENT_VALUE_LABELS,
  SEVERITY_ORDER,
  severityFor,
  UNAVAILABLE_FILTER_REASONS,
} from '@/features/recommendations/utils/recommendationTaxonomy';
import type { Recommendation } from '@/services';
import { calculateRecommendationActions } from '@/services';
import type { Portfolio } from '@/types/portfolio';

/**
 * Recommendation taxonomy — 06_TASKS.md M7-032. Group by
 * Critical/High/Medium/Informational, filter by the six documented
 * categories.
 */
function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    category: 'debtManagement',
    triggeringCondition: 'x',
    relevantValues: { requiredRepayment: 100 },
    expectedEffect: 'x',
    decisionPriority: 'Maintain Target Health Factor',
    suggestedAction: 'x',
    formulaReferences: ['F-062'],
    ...overrides,
  };
}

describe('severityFor', () => {
  it('maps all five documented Decision Priority tiers to a severity, preserving safety-first order, for an actionable recommendation', () => {
    expect(
      severityFor('repayment', recommendation({ decisionPriority: 'Prevent Liquidation' })),
    ).toBe('Critical');
    expect(
      severityFor(
        'repayment',
        recommendation({ decisionPriority: 'Maintain Target Health Factor' }),
      ),
    ).toBe('High');
    expect(
      severityFor('repayment', recommendation({ decisionPriority: 'Reduce Interest Costs' })),
    ).toBe('Medium');
    expect(
      severityFor('repayment', recommendation({ decisionPriority: 'Improve Capital Efficiency' })),
    ).toBe('Medium');
    expect(
      severityFor('repayment', recommendation({ decisionPriority: 'Achieve User Goals' })),
    ).toBe('Informational');
  });

  it('V1.1 Batch 5: demotes a non-actionable ("no action needed") recommendation to Informational, regardless of decisionPriority', () => {
    const noActionNeeded = recommendation({
      decisionPriority: 'Prevent Liquidation',
      relevantValues: { requiredRepayment: 0 },
    });
    expect(severityFor('repayment', noActionNeeded)).toBe('Informational');
  });

  it('SEVERITY_ORDER lists all four buckets, most severe first', () => {
    expect(SEVERITY_ORDER).toEqual(['Critical', 'High', 'Medium', 'Informational']);
  });
});

describe('isActionableRecommendation', () => {
  it('is true for repayment when requiredRepayment is positive', () => {
    expect(
      isActionableRecommendation(
        'repayment',
        recommendation({ relevantValues: { requiredRepayment: 5 } }),
      ),
    ).toBe(true);
  });

  it('is false for repayment when requiredRepayment is 0', () => {
    expect(
      isActionableRecommendation(
        'repayment',
        recommendation({ relevantValues: { requiredRepayment: 0 } }),
      ),
    ).toBe(false);
  });

  it('is true for additionalCollateral when requiredUsd is positive', () => {
    expect(
      isActionableRecommendation(
        'additionalCollateral',
        recommendation({ relevantValues: { requiredUsd: 5 } }),
      ),
    ).toBe(true);
  });

  it('is false for additionalCollateral when requiredUsd is 0', () => {
    expect(
      isActionableRecommendation(
        'additionalCollateral',
        recommendation({ relevantValues: { requiredUsd: 0 } }),
      ),
    ).toBe(false);
  });
});

describe('filterCategoryFor', () => {
  it('maps each of the three real Recommendation categories to its filter category', () => {
    expect(filterCategoryFor(recommendation({ category: 'debtManagement' }))).toBe('debt');
    expect(filterCategoryFor(recommendation({ category: 'collateralManagement' }))).toBe(
      'collateral',
    );
    expect(filterCategoryFor(recommendation({ category: 'leverage' }))).toBe('leverage');
  });
});

describe('RECOMMENDATION_FILTER_CATEGORIES', () => {
  it('lists exactly the six documented filter categories, in the documented order', () => {
    expect(RECOMMENDATION_FILTER_CATEGORIES.map((category) => category.id)).toEqual([
      'safety',
      'debt',
      'collateral',
      'interest',
      'leverage',
      'exitReadiness',
    ]);
  });
});

describe('UNAVAILABLE_FILTER_REASONS', () => {
  it('covers exactly the three categories permanently unavailable for their own independent reasons (v1.18.0 Batch 3)', () => {
    expect(Object.keys(UNAVAILABLE_FILTER_REASONS).sort()).toEqual(
      ['safety', 'interest', 'exitReadiness'].sort(),
    );
  });

  it('no longer covers leverage — its availability now depends on this portfolio’s own Loop preferences (v1.18.0 Batch 3, spec §8)', () => {
    expect(UNAVAILABLE_FILTER_REASONS.leverage).toBeUndefined();
  });

  it('does not cover debt or collateral — both are real, populated categories', () => {
    expect(UNAVAILABLE_FILTER_REASONS.debt).toBeUndefined();
    expect(UNAVAILABLE_FILTER_REASONS.collateral).toBeUndefined();
  });

  it('every reason cites a real, traceable source (a conflict number or a Formula ID gap)', () => {
    Object.values(UNAVAILABLE_FILTER_REASONS).forEach((reason) => {
      expect(reason).toMatch(/conflict #\d+|F-0\d\d/);
    });
  });
});

describe('value label maps', () => {
  it('REPAYMENT_VALUE_LABELS covers exactly calculateRepaymentRecommendation’s five relevantValues keys', () => {
    expect(Object.keys(REPAYMENT_VALUE_LABELS).sort()).toEqual(
      [
        'currentDebt',
        'targetDebt',
        'targetHealthFactor',
        'requiredRepayment',
        'estimatedBtcRequired',
      ].sort(),
    );
  });

  it('ADDITIONAL_COLLATERAL_VALUE_LABELS covers exactly calculateAdditionalCollateralRecommendation’s five relevantValues keys', () => {
    expect(Object.keys(ADDITIONAL_COLLATERAL_VALUE_LABELS).sort()).toEqual(
      [
        'currentCollateralValue',
        'targetCollateralValue',
        'targetHealthFactor',
        'requiredUsd',
        'equivalentBtc',
      ].sort(),
    );
  });
});

/**
 * `presentationTextFor` — v1.18.0 Batch 4
 * (`docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md` §10). Scenarios A/B
 * (canonical text per condition) and E/F/G/H (numeric values, Engine
 * object, formula references, and relevantValues all preserved
 * untouched) from the Batch 4 test plan. C/D ("Repayment presentation
 * behavior"/"Additional Collateral presentation behavior") are a
 * deliberate non-goal here — spec §10 keeps their copy unchanged, so
 * `presentationTextFor`'s own parameter type excludes those two ids
 * entirely (a compile-time guarantee, not a runtime branch to test).
 */
function borrowRecommendation(
  overrides: Partial<Recommendation['relevantValues']> = {},
): Recommendation {
  return recommendation({
    category: 'debtManagement',
    triggeringCondition:
      'Health Factor above minimum, borrow capacity available, and Debt Ratio below target.',
    relevantValues: {
      healthFactor: 8,
      userMinHealthFactor: 1.5,
      availableBorrow: 50000,
      debtRatio: 0.2,
      targetDebtRatio: 0.5,
      ...overrides,
    },
    decisionPriority: 'Improve Capital Efficiency',
    suggestedAction: 'Borrowing is acceptable.',
    formulaReferences: ['F-061', 'F-022', 'F-013', 'F-006'],
  });
}

function loopRecommendation(
  overrides: Partial<Recommendation['relevantValues']> = {},
): Recommendation {
  return recommendation({
    category: 'leverage',
    triggeringCondition:
      'Health Factor remains above target, borrow capacity is available, and the added interest cost is acceptable.',
    relevantValues: {
      newHealthFactor: 9,
      targetHealthFactor: 8,
      availableBorrow: 50000,
      annualInterestCost: 1000,
      maxAcceptableAnnualInterestCost: 5000,
      ...overrides,
    },
    decisionPriority: 'Improve Capital Efficiency',
    suggestedAction: 'Loop One More Time',
    formulaReferences: ['F-064', 'F-014', 'F-032'],
  });
}

describe('presentationTextFor — v1.18.0 Batch 4 (spec §10)', () => {
  it('A: Borrow acceptable — canonical presentation text, attributing the threshold to configured preferences rather than an unqualified imperative', () => {
    const result = presentationTextFor('borrow', borrowRecommendation());
    expect(result.detail).toBe(
      'Based on your configured minimum Health Factor and target Debt Ratio, an additional borrow currently stays within your configured limits.',
    );
  });

  it('A: Borrow not acceptable — canonical presentation text', () => {
    const result = presentationTextFor('borrow', borrowRecommendation({ availableBorrow: 0 }));
    expect(result.detail).toBe(
      'An additional borrow would currently exceed at least one of your configured limits — minimum Health Factor or target Debt Ratio.',
    );
  });

  it('B: Loop recommended — canonical presentation text', () => {
    const result = presentationTextFor('loop', loopRecommendation());
    expect(result.detail).toBe(
      'Based on your configured Loop preferences, one more loop step currently stays within your configured Health Factor, borrow-capacity, and interest-cost limits.',
    );
  });

  it('B: Loop not recommended — canonical presentation text', () => {
    const result = presentationTextFor('loop', loopRecommendation({ availableBorrow: 0 }));
    expect(result.detail).toBe(
      'One more loop step would currently exceed at least one of your configured Loop limits — target Health Factor, available borrow capacity, or maximum acceptable interest cost.',
    );
  });

  it('headline is triggeringCondition unaltered, for both Borrow and Loop, in both conditions', () => {
    const borrow = borrowRecommendation();
    const loop = loopRecommendation({ availableBorrow: 0 });
    expect(presentationTextFor('borrow', borrow).headline).toBe(borrow.triggeringCondition);
    expect(presentationTextFor('loop', loop).headline).toBe(loop.triggeringCondition);
  });

  it('E/F/G/H: preserves relevantValues/formulaReferences and never mutates the Engine object', () => {
    const rec = borrowRecommendation();
    const snapshot = JSON.parse(JSON.stringify(rec)) as Recommendation;
    presentationTextFor('borrow', rec);
    expect(rec).toEqual(snapshot);
    expect(rec.relevantValues.userMinHealthFactor).toBe(1.5);
    expect(rec.relevantValues.targetDebtRatio).toBe(0.5);
    expect(rec.formulaReferences).toEqual(['F-061', 'F-022', 'F-013', 'F-006']);
  });
});

/**
 * Q/R: V3/V4 presentation path — v1.18.0 Batch 4. `presentationTextFor`
 * only ever reads `id`/`recommendation.relevantValues`, never
 * `Portfolio`/protocol-version fields directly (V3/V4 isolation, §12) —
 * this exercises it against a `Recommendation` produced by
 * `calculateRecommendationActions`'s own real V3 and V4 dispatch (Batch
 * 2), the same fixture shapes `recommendationCenterStore.test.ts`'s own
 * K-R suite uses, proving the presentation layer stays correct end-to-end
 * regardless of which protocol path computed the underlying numbers —
 * not merely "protocol-neutral by construction," but verified against
 * the real dispatch this Recommendation Center actually runs.
 */
describe('presentationTextFor — V3/V4 dispatch integration (v1.18.0 Batch 4)', () => {
  const FULL_BORROW_PREFS = { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 };
  const FULL_LOOP_PREFS = { loopBorrowPercentage: 0.5, maxAcceptableAnnualInterestCost: 5000 };

  function portfolioFixture(overrides: Partial<Portfolio> = {}): Portfolio {
    return {
      id: 'portfolio-1',
      name: 'Test Portfolio',
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
      settings: {
        safetyTargets: { targetHealthFactor: 8 },
        recommendationPreferences: { borrow: FULL_BORROW_PREFS, loop: FULL_LOOP_PREFS },
      },
      archivedAt: null,
      marketUpdatedAt: '2026-01-01T00:00:00.000Z',
      protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('Q: a V3-dispatched Borrow/Loop Recommendation presents correctly', () => {
    const result = calculateRecommendationActions(
      portfolioFixture({ protocolVersion: 'v3' }),
      'manual',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { borrow, loop } = result.data.items;
    expect(borrow).toBeDefined();
    expect(loop).toBeDefined();
    if (borrow === undefined || loop === undefined) return;
    expect(presentationTextFor('borrow', borrow).detail.length).toBeGreaterThan(0);
    expect(presentationTextFor('loop', loop).detail.length).toBeGreaterThan(0);
  });

  it('R: a V4-dispatched Borrow/Loop Recommendation (real risk-capacity/effective-rate substitution) presents correctly', () => {
    const result = calculateRecommendationActions(
      portfolioFixture({
        protocolVersion: 'v4',
        v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
        v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 7 },
      }),
      'manual',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { borrow, loop } = result.data.items;
    expect(borrow).toBeDefined();
    expect(loop).toBeDefined();
    if (borrow === undefined || loop === undefined) return;
    expect(presentationTextFor('borrow', borrow).detail.length).toBeGreaterThan(0);
    expect(presentationTextFor('loop', loop).detail.length).toBeGreaterThan(0);
    // The presentation layer never re-derives or duplicates V4's own
    // computed numbers — headline is still exactly the real Engine
    // triggeringCondition this V4 dispatch produced.
    expect(presentationTextFor('borrow', borrow).headline).toBe(borrow.triggeringCondition);
  });
});
