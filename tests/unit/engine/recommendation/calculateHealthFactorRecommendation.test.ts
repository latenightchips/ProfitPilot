import { describe, expect, it } from 'vitest';

import {
  calculateHealthFactorRecommendation,
  HEALTH_FACTOR_ACTIONABLE_CATEGORIES,
  type HealthFactorRecommendationParams,
} from '@/engine/recommendation/calculateHealthFactorRecommendation';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 1,
  borrowApr: 0.01,
  supplyApr: 0.02,
};

/**
 * `liquidationThreshold: 1` and `debt.balance: 1` make Health Factor
 * exactly equal `market.btcPriceUsd` (`collateralValue * 1 / 1`), so each
 * fixture's own `btcPriceUsd` directly is the Health Factor under test —
 * `calculateRiskCategory`'s own boundary values are already exhaustively
 * tested in `calculateRiskCategory.test.ts`; these are representative
 * values per category, not a re-test of the boundaries themselves.
 */
function baseParams(
  overrides: Partial<HealthFactorRecommendationParams> = {},
): HealthFactorRecommendationParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 1 },
    market: { btcPriceUsd: 3 },
    protocol,
  };
  return { portfolio, ...overrides };
}

function portfolioWithHealthFactor(btcPriceUsd: number): PortfolioInput {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 1 },
    market: { btcPriceUsd },
    protocol,
  };
}

describe('calculateHealthFactorRecommendation (F-060, owner decision)', () => {
  it('tags F-060 at runtime and cites F-060/F-026/F-022 as formulaReferences', () => {
    const result = calculateHealthFactorRecommendation(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.formulaId).toBe('F-060');
    expect(result.value.category).toBe('healthFactor');
    expect(result.value.formulaReferences).toEqual(['F-060', 'F-026', 'F-022']);
  });

  it('fixes decisionPriority to Prevent Liquidation regardless of risk category', () => {
    const safe = calculateHealthFactorRecommendation({ portfolio: portfolioWithHealthFactor(3) });
    const liquidation = calculateHealthFactorRecommendation({
      portfolio: portfolioWithHealthFactor(1),
    });
    expect(safe.ok).toBe(true);
    expect(liquidation.ok).toBe(true);
    if (!safe.ok || !liquidation.ok) return;
    expect(safe.value.decisionPriority).toBe('Prevent Liquidation');
    expect(liquidation.value.decisionPriority).toBe('Prevent Liquidation');
  });

  it.each<[number, string, string]>([
    [3, 'SAFE', 'No action required.'],
    [2.2, 'MONITOR', 'No action required.'],
    [1.8, 'ELEVATED', 'Avoid additional borrowing.'],
    [1.3, 'HIGH RISK', 'Reduce debt or add collateral.'],
    [1.0, 'LIQUIDATION RISK', 'Immediate action recommended.'],
  ])(
    'maps Health Factor %s (%s) to the exact owner-decided guidance text %j',
    (btcPriceUsd, expectedCategory, expectedGuidance) => {
      const result = calculateHealthFactorRecommendation({
        portfolio: portfolioWithHealthFactor(btcPriceUsd),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.triggeringCondition).toBe(
        `Health Factor risk category: ${expectedCategory}.`,
      );
      expect(result.value.suggestedAction).toBe(expectedGuidance);
      expect(result.value.expectedEffect).toBe(
        `Reflects the portfolio's current ${expectedCategory} Health Factor risk category.`,
      );
    },
  );

  it('stores only the raw healthFactor in relevantValues — never a second, independently-derived category', () => {
    const result = calculateHealthFactorRecommendation({
      portfolio: portfolioWithHealthFactor(1.8),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.relevantValues).toEqual({ healthFactor: 1.8 });
  });

  it('classifies a zero-debt (Infinity Health Factor) portfolio as SAFE with a warning, not a failure', () => {
    const result = calculateHealthFactorRecommendation({
      portfolio: {
        collateral: { asset: 'BTC', quantity: 1 },
        debt: { asset: 'USDC', balance: 0 },
        market: { btcPriceUsd: 60000 },
        protocol,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.triggeringCondition).toBe('Health Factor risk category: SAFE.');
    expect(result.value.suggestedAction).toBe('No action required.');
    expect(result.warnings.some((w) => w.code === 'NO_DEBT')).toBe(true);
  });

  it('HEALTH_FACTOR_ACTIONABLE_CATEGORIES contains exactly ELEVATED, HIGH RISK, LIQUIDATION RISK', () => {
    expect([...HEALTH_FACTOR_ACTIONABLE_CATEGORIES].sort()).toEqual(
      ['ELEVATED', 'HIGH RISK', 'LIQUIDATION RISK'].sort(),
    );
    expect(HEALTH_FACTOR_ACTIONABLE_CATEGORIES.has('SAFE')).toBe(false);
    expect(HEALTH_FACTOR_ACTIONABLE_CATEGORIES.has('MONITOR')).toBe(false);
  });

  it('propagates a failure from invalid debt input', () => {
    const result = calculateHealthFactorRecommendation({
      portfolio: {
        collateral: { asset: 'BTC', quantity: 1 },
        debt: { asset: 'USDC', balance: -1 },
        market: { btcPriceUsd: 60000 },
        protocol,
      },
    });
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid protocol liquidationThreshold', () => {
    const result = calculateHealthFactorRecommendation({
      portfolio: {
        collateral: { asset: 'BTC', quantity: 1 },
        debt: { asset: 'USDC', balance: 1 },
        market: { btcPriceUsd: 60000 },
        protocol: { ...protocol, liquidationThreshold: -0.1 },
      },
    });
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from invalid collateral input', () => {
    const result = calculateHealthFactorRecommendation({
      portfolio: {
        collateral: { asset: 'BTC', quantity: -1 },
        debt: { asset: 'USDC', balance: 1 },
        market: { btcPriceUsd: 60000 },
        protocol,
      },
    });
    expect(result.ok).toBe(false);
  });
});
