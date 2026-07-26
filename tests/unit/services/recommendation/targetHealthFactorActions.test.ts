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
