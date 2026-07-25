import { describe, expect, it } from 'vitest';

import {
  generateRecommendations,
  type GenerateRecommendationsParams,
} from '@/engine/recommendation/generateRecommendations';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseParams(
  overrides: Partial<GenerateRecommendationsParams> = {},
): GenerateRecommendationsParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 30000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    rules: {
      borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 },
      repayment: { targetHealthFactor: 2.0 },
      additionalCollateral: { targetHealthFactor: 4.0 },
      loop: {
        targetHealthFactor: 1.5,
        loopBorrowPercentage: 0.5,
        maxAcceptableAnnualInterestCost: 5000,
      },
    },
    ...overrides,
  };
}

describe('generateRecommendations (M2-025, F-061)', () => {
  it('runs every implemented rule and returns one recommendation per rule', () => {
    const result = generateRecommendations(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-061');
    expect(result.value.recommendations).toHaveLength(4);
    const categories = result.value.recommendations.map((r) => r.category);
    expect(categories).toEqual([
      'debtManagement',
      'debtManagement',
      'collateralManagement',
      'leverage',
    ]);
  });

  it('itemizes the three unimplemented categories, with a reason for each', () => {
    const result = generateRecommendations(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const categories = result.value.unavailableCategories.map((c) => c.category);
    expect(categories).toEqual(['safety', 'interestCost', 'exitReadiness']);
    for (const entry of result.value.unavailableCategories) {
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  it('every recommendation is traceable per M2-026 (all six fields populated)', () => {
    const result = generateRecommendations(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const recommendation of result.value.recommendations) {
      expect(recommendation.triggeringCondition.length).toBeGreaterThan(0);
      expect(Object.keys(recommendation.relevantValues).length).toBeGreaterThan(0);
      expect(recommendation.expectedEffect.length).toBeGreaterThan(0);
      expect(recommendation.decisionPriority.length).toBeGreaterThan(0);
      expect(recommendation.suggestedAction.length).toBeGreaterThan(0);
      expect(recommendation.formulaReferences.length).toBeGreaterThan(0);
    }
  });

  it('propagates a failure from an invalid borrow rule parameter', () => {
    const result = generateRecommendations(
      baseParams({
        rules: {
          borrow: { userMinHealthFactor: 0, targetDebtRatio: 0.5 },
          repayment: { targetHealthFactor: 2.0 },
          additionalCollateral: { targetHealthFactor: 4.0 },
          loop: {
            targetHealthFactor: 1.5,
            loopBorrowPercentage: 0.5,
            maxAcceptableAnnualInterestCost: 5000,
          },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid repayment rule parameter', () => {
    const result = generateRecommendations(
      baseParams({
        rules: {
          borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 },
          repayment: { targetHealthFactor: 0 },
          additionalCollateral: { targetHealthFactor: 4.0 },
          loop: {
            targetHealthFactor: 1.5,
            loopBorrowPercentage: 0.5,
            maxAcceptableAnnualInterestCost: 5000,
          },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid loop rule parameter', () => {
    const result = generateRecommendations(
      baseParams({
        rules: {
          borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 },
          repayment: { targetHealthFactor: 2.0 },
          additionalCollateral: { targetHealthFactor: 4.0 },
          loop: {
            targetHealthFactor: 1.5,
            loopBorrowPercentage: 0.5,
            maxAcceptableAnnualInterestCost: 0,
          },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid additionalCollateral rule parameter', () => {
    const result = generateRecommendations(
      baseParams({
        rules: {
          borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 },
          repayment: { targetHealthFactor: 2.0 },
          additionalCollateral: { targetHealthFactor: 0 },
          loop: {
            targetHealthFactor: 1.5,
            loopBorrowPercentage: 0.5,
            maxAcceptableAnnualInterestCost: 5000,
          },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });
});
