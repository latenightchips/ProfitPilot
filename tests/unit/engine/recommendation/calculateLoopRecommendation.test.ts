import { describe, expect, it } from 'vitest';

import {
  calculateLoopRecommendation,
  type LoopRecommendationParams,
} from '@/engine/recommendation/calculateLoopRecommendation';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseParams(overrides: Partial<LoopRecommendationParams> = {}): LoopRecommendationParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    targetHealthFactor: 1.5,
    loopBorrowPercentage: 0.5,
    maxAcceptableAnnualInterestCost: 2000,
    ...overrides,
  };
}

describe('calculateLoopRecommendation (M2-025, F-064)', () => {
  it('recommends looping again when all three conditions are satisfied', () => {
    const result = calculateLoopRecommendation(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-064');
    expect(result.value.category).toBe('leverage');
    expect(result.value.suggestedAction).toBe('Loop One More Time');
    expect(result.value.relevantValues.newHealthFactor).toBeCloseTo(3.085714, 6);
    expect(result.value.relevantValues.annualInterestCost).toBe(1050);
    expect(result.value.formulaReferences).toEqual(['F-064', 'F-014', 'F-032']);
  });

  it('recommends stopping when the interest cost exceeds the acceptable maximum', () => {
    const result = calculateLoopRecommendation(
      baseParams({ maxAcceptableAnnualInterestCost: 500 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.suggestedAction).toBe('Stop Looping');
  });

  it('recommends stopping when the resulting Health Factor would fall to or below target', () => {
    const result = calculateLoopRecommendation(baseParams({ targetHealthFactor: 5 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.suggestedAction).toBe('Stop Looping');
  });

  it('always reports the expected Health Factor after the proposed loop', () => {
    const result = calculateLoopRecommendation(baseParams({ maxAcceptableAnnualInterestCost: 1 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.suggestedAction).toBe('Stop Looping');
      expect(result.value.relevantValues.newHealthFactor).toBeCloseTo(3.085714, 6);
    }
  });

  it('propagates a failure from invalid collateral input', () => {
    const result = calculateLoopRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: -1 },
          debt: { asset: 'USDC', balance: 0 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a non-positive targetHealthFactor', () => {
    expect(calculateLoopRecommendation(baseParams({ targetHealthFactor: 0 })).ok).toBe(false);
  });

  it('rejects a non-positive maxAcceptableAnnualInterestCost', () => {
    expect(calculateLoopRecommendation(baseParams({ maxAcceptableAnnualInterestCost: 0 })).ok).toBe(
      false,
    );
  });
});
