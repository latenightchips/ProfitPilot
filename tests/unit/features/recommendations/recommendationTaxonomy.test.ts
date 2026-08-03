import { describe, expect, it } from 'vitest';

import {
  ADDITIONAL_COLLATERAL_VALUE_LABELS,
  filterCategoryFor,
  RECOMMENDATION_FILTER_CATEGORIES,
  REPAYMENT_VALUE_LABELS,
  SEVERITY_ORDER,
  severityFor,
  UNAVAILABLE_FILTER_REASONS,
} from '@/features/recommendations/utils/recommendationTaxonomy';
import type { Recommendation } from '@/services';

/**
 * Recommendation taxonomy — 06_TASKS.md M7-032. Group by
 * Critical/High/Medium/Informational, filter by the six documented
 * categories.
 */
function recommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    category: 'debtManagement',
    triggeringCondition: 'x',
    relevantValues: {},
    expectedEffect: 'x',
    decisionPriority: 'Maintain Target Health Factor',
    suggestedAction: 'x',
    formulaReferences: ['F-062'],
    ...overrides,
  };
}

describe('severityFor', () => {
  it('maps all five documented Decision Priority tiers to a severity, preserving safety-first order', () => {
    expect(severityFor(recommendation({ decisionPriority: 'Prevent Liquidation' }))).toBe(
      'Critical',
    );
    expect(severityFor(recommendation({ decisionPriority: 'Maintain Target Health Factor' }))).toBe(
      'High',
    );
    expect(severityFor(recommendation({ decisionPriority: 'Reduce Interest Costs' }))).toBe(
      'Medium',
    );
    expect(severityFor(recommendation({ decisionPriority: 'Improve Capital Efficiency' }))).toBe(
      'Medium',
    );
    expect(severityFor(recommendation({ decisionPriority: 'Achieve User Goals' }))).toBe(
      'Informational',
    );
  });

  it('SEVERITY_ORDER lists all four buckets, most severe first', () => {
    expect(SEVERITY_ORDER).toEqual(['Critical', 'High', 'Medium', 'Informational']);
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
  it('covers exactly the four categories this Recommendation Center never populates', () => {
    expect(Object.keys(UNAVAILABLE_FILTER_REASONS).sort()).toEqual(
      ['safety', 'interest', 'leverage', 'exitReadiness'].sort(),
    );
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
