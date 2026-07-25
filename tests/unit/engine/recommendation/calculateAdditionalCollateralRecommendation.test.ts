import { describe, expect, it } from 'vitest';

import {
  type AdditionalCollateralRecommendationParams,
  calculateAdditionalCollateralRecommendation,
} from '@/engine/recommendation/calculateAdditionalCollateralRecommendation';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseParams(
  overrides: Partial<AdditionalCollateralRecommendationParams> = {},
): AdditionalCollateralRecommendationParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 60000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    targetHealthFactor: 1.0,
    ...overrides,
  };
}

describe('calculateAdditionalCollateralRecommendation (M2-025, F-063)', () => {
  it('computes the required additional collateral by inverting F-022', () => {
    const result = calculateAdditionalCollateralRecommendation(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-063');
    expect(result.value.category).toBe('collateralManagement');
    expect(result.value.relevantValues.targetCollateralValue).toBe(75000);
    expect(result.value.relevantValues.requiredUsd).toBe(15000);
    expect(result.value.relevantValues.equivalentBtc).toBeCloseTo(0.25, 8);
    expect(result.value.formulaReferences).toEqual(['F-063', 'F-022']);
  });

  it('reports no additional collateral needed when already above the target', () => {
    const result = calculateAdditionalCollateralRecommendation(
      baseParams({ targetHealthFactor: 0.5 }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.relevantValues.requiredUsd).toBe(0);
    expect(result.value.suggestedAction).toBe('No additional collateral needed.');
  });

  it('propagates a failure from a non-positive target Health Factor', () => {
    expect(
      calculateAdditionalCollateralRecommendation(baseParams({ targetHealthFactor: 0 })).ok,
    ).toBe(false);
  });

  it('propagates a failure from an invalid protocol liquidation threshold', () => {
    const result = calculateAdditionalCollateralRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 1 },
          debt: { asset: 'USDC', balance: 60000 },
          market: { btcPriceUsd: 60000 },
          protocol: { ...protocol, liquidationThreshold: 1.5 },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from a non-positive BTC price', () => {
    const result = calculateAdditionalCollateralRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 1 },
          debt: { asset: 'USDC', balance: 60000 },
          market: { btcPriceUsd: 0 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from invalid debt input', () => {
    const result = calculateAdditionalCollateralRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 1 },
          debt: { asset: 'USDC', balance: -1 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from invalid collateral input', () => {
    const result = calculateAdditionalCollateralRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: -1 },
          debt: { asset: 'USDC', balance: 60000 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });
});
