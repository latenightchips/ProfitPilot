import { describe, expect, it } from 'vitest';

import {
  calculateRepaymentRecommendation,
  type RepaymentRecommendationParams,
} from '@/engine/recommendation/calculateRepaymentRecommendation';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseParams(
  overrides: Partial<RepaymentRecommendationParams> = {},
): RepaymentRecommendationParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 60000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    targetHealthFactor: 2.0,
    ...overrides,
  };
}

describe('calculateRepaymentRecommendation (M2-025, F-062)', () => {
  it('computes the required repayment reusing F-040/F-041/F-042', () => {
    const result = calculateRepaymentRecommendation(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-062');
    expect(result.value.category).toBe('debtManagement');
    expect(result.value.relevantValues.targetDebt).toBe(48000);
    expect(result.value.relevantValues.requiredRepayment).toBe(12000);
    expect(result.value.relevantValues.estimatedBtcRequired).toBeCloseTo(0.2, 8);
    expect(result.value.formulaReferences).toEqual(['F-062', 'F-040', 'F-041', 'F-042']);
  });

  it('reports no repayment needed when already above the target', () => {
    const result = calculateRepaymentRecommendation(baseParams({ targetHealthFactor: 1.0 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.relevantValues.requiredRepayment).toBe(0);
    expect(result.value.suggestedAction).toBe('No repayment needed.');
  });

  it('propagates a failure from a non-positive target Health Factor', () => {
    expect(calculateRepaymentRecommendation(baseParams({ targetHealthFactor: 0 })).ok).toBe(false);
  });

  it('propagates a failure from invalid collateral input', () => {
    const result = calculateRepaymentRecommendation(
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

  it('propagates a failure from invalid debt input', () => {
    const result = calculateRepaymentRecommendation(
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
});
