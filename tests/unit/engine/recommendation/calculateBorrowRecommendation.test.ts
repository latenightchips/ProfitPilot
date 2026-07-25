import { describe, expect, it } from 'vitest';

import {
  type BorrowRecommendationParams,
  calculateBorrowRecommendation,
} from '@/engine/recommendation/calculateBorrowRecommendation';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseParams(
  overrides: Partial<BorrowRecommendationParams> = {},
): BorrowRecommendationParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 30000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    userMinHealthFactor: 1.5,
    targetDebtRatio: 0.5,
    ...overrides,
  };
}

describe('calculateBorrowRecommendation (M2-025, F-061)', () => {
  it('recommends borrowing when all three conditions are satisfied', () => {
    const result = calculateBorrowRecommendation(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-061');
    expect(result.value.category).toBe('debtManagement');
    expect(result.value.suggestedAction).toBe('Borrowing is acceptable.');
    expect(result.value.relevantValues.healthFactor).toBeCloseTo(3.2, 6);
    expect(result.value.relevantValues.availableBorrow).toBeCloseTo(54000, 6);
    expect(result.value.relevantValues.debtRatio).toBeCloseTo(0.25, 6);
    expect(result.value.formulaReferences).toContain('F-006');
  });

  it('does not recommend borrowing when the Debt Ratio condition fails', () => {
    const result = calculateBorrowRecommendation(baseParams({ targetDebtRatio: 0.1 }));
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.suggestedAction).toBe('Do not recommend additional borrowing.');
  });

  it('does not recommend borrowing when the Health Factor condition fails', () => {
    const result = calculateBorrowRecommendation(baseParams({ userMinHealthFactor: 5 }));
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.value.suggestedAction).toBe('Do not recommend additional borrowing.');
  });

  it('does not recommend borrowing when there is no available borrow capacity, isolated from the other two conditions', () => {
    // debt = capacity (120000*0.7), so availableBorrow = 0 exactly, while
    // HF (1.142857) and Debt Ratio (0.7) are kept within the (relaxed)
    // thresholds below, isolating the availableBorrowOk branch.
    const result = calculateBorrowRecommendation(
      baseParams({
        portfolio: { ...baseParams().portfolio, debt: { asset: 'USDC', balance: 84000 } },
        userMinHealthFactor: 1.0,
        targetDebtRatio: 0.9,
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.relevantValues.healthFactor).toBeGreaterThan(1.0);
      expect(result.value.relevantValues.availableBorrow).toBe(0);
      expect(result.value.suggestedAction).toBe('Do not recommend additional borrowing.');
    }
  });

  it('propagates a failure from invalid collateral input', () => {
    const result = calculateBorrowRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: -1 },
          debt: { asset: 'USDC', balance: 30000 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from invalid debt input', () => {
    const result = calculateBorrowRecommendation(
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

  it('propagates a failure from an invalid protocol liquidation threshold', () => {
    const result = calculateBorrowRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: 30000 },
          market: { btcPriceUsd: 60000 },
          protocol: { ...protocol, liquidationThreshold: 1.5 },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid protocol maxLoanToValue', () => {
    const result = calculateBorrowRecommendation(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: 30000 },
          market: { btcPriceUsd: 60000 },
          protocol: { ...protocol, maxLoanToValue: 1.5 },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a non-positive userMinHealthFactor', () => {
    expect(calculateBorrowRecommendation(baseParams({ userMinHealthFactor: 0 })).ok).toBe(false);
  });

  it('rejects an out-of-range targetDebtRatio', () => {
    expect(calculateBorrowRecommendation(baseParams({ targetDebtRatio: 1.5 })).ok).toBe(false);
  });
});
