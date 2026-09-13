import { describe, expect, it } from 'vitest';

import {
  calculateInterestCostRecommendation,
  type InterestCostRecommendationParams,
} from '@/engine/recommendation/calculateInterestCostRecommendation';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.01,
  supplyApr: 0.02,
};

function baseParams(
  overrides: Partial<InterestCostRecommendationParams> = {},
): InterestCostRecommendationParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 100000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    expectedAnnualPortfolioGrowthUsd: 1000,
    ...overrides,
  };
}

describe('calculateInterestCostRecommendation (F-065, owner decision)', () => {
  it('tags F-065 at runtime and reuses F-032/F-003 as formulaReferences', () => {
    const result = calculateInterestCostRecommendation(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.formulaId).toBe('F-065');
    expect(result.value.category).toBe('interestCost');
    expect(result.value.decisionPriority).toBe('Reduce Interest Costs');
    expect(result.value.formulaReferences).toEqual(['F-065', 'F-032', 'F-003']);
  });

  it('does not warn when debt is zero, regardless of a valid configured growth figure (0/0)', () => {
    const result = calculateInterestCostRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: 0 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
        expectedAnnualPortfolioGrowthUsd: 0,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relevantValues.annualInterestUsd).toBe(0);
    expect(result.value.relevantValues.expectedAnnualPortfolioGrowthUsd).toBe(0);
    expect(result.value.suggestedAction).toBe('No action needed — interest cost is not flagged.');
  });

  it('does not warn when Annual Interest is strictly below Expected Annual Portfolio Growth (999.99 vs 1000)', () => {
    const result = calculateInterestCostRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: 99999 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
        expectedAnnualPortfolioGrowthUsd: 1000,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relevantValues.annualInterestUsd).toBeCloseTo(999.99, 6);
    expect(result.value.suggestedAction).toBe('No action needed — interest cost is not flagged.');
  });

  it('does not warn on exact equality — strict ">" only (1000 vs 1000)', () => {
    const result = calculateInterestCostRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: 100000 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
        expectedAnnualPortfolioGrowthUsd: 1000,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relevantValues.annualInterestUsd).toBe(1000);
    expect(result.value.suggestedAction).toBe('No action needed — interest cost is not flagged.');
  });

  it('warns when Annual Interest strictly exceeds Expected Annual Portfolio Growth (1000.01 vs 1000)', () => {
    const result = calculateInterestCostRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: 100001 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
        expectedAnnualPortfolioGrowthUsd: 1000,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relevantValues.annualInterestUsd).toBeCloseTo(1000.01, 6);
    expect(result.value.suggestedAction).toBe('Interest costs may outweigh expected returns.');
    expect(result.value.expectedEffect).toBe('Interest costs may outweigh expected returns.');
  });

  it('rejects a negative expectedAnnualPortfolioGrowthUsd', () => {
    const result = calculateInterestCostRecommendation(
      baseParams({ expectedAnnualPortfolioGrowthUsd: -1 }),
    );
    expect(result.ok).toBe(false);
  });

  it('accepts zero as a valid expectedAnnualPortfolioGrowthUsd', () => {
    const result = calculateInterestCostRecommendation(
      baseParams({ expectedAnnualPortfolioGrowthUsd: 0 }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a non-finite expectedAnnualPortfolioGrowthUsd', () => {
    expect(
      calculateInterestCostRecommendation(
        baseParams({ expectedAnnualPortfolioGrowthUsd: Number.POSITIVE_INFINITY }),
      ).ok,
    ).toBe(false);
    expect(
      calculateInterestCostRecommendation(
        baseParams({ expectedAnnualPortfolioGrowthUsd: Number.NaN }),
      ).ok,
    ).toBe(false);
  });

  it('propagates a failure from invalid debt input', () => {
    const result = calculateInterestCostRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: -1 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid protocol borrowApr', () => {
    const result = calculateInterestCostRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: 100000 },
          market: { btcPriceUsd: 60000 },
          protocol: { ...protocol, borrowApr: -0.1 },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });
});
