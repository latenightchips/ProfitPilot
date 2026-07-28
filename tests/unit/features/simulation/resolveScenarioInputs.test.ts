import { describe, expect, it } from 'vitest';

import type { ScenarioBuilderFormValues } from '@/features/simulation';
import { resolvePriceScenarioInput, resolveTimeHorizonDays } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';

/**
 * Scenario Builder input resolution — 06_TASKS.md M6-006 ("Implement
 * Interest Rate Simulation"). These pure helpers turn the Scenario
 * Builder's current form state into the `PriceScenarioInput`/
 * `timeHorizonDays` pieces an interest scenario needs alongside Borrow
 * Rate.
 */
function portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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
    ...overrides,
  };
}

function values(overrides: Partial<ScenarioBuilderFormValues> = {}): ScenarioBuilderFormValues {
  return {
    btcPriceUsd: '50000',
    percentageChange: '',
    borrowApr: '0.05',
    collateralDelta: '0',
    debtDelta: '0',
    targetHealthFactor: '',
    holdingPeriod: '30',
    customHoldingPeriodDays: '',
    ...overrides,
  };
}

describe('resolvePriceScenarioInput', () => {
  it('resolves to the absolute BTC price when Percentage Change is empty', () => {
    const result = resolvePriceScenarioInput(values({ btcPriceUsd: '60000' }), portfolio());
    expect(result).toEqual({ type: 'absolute', btcPriceUsd: 60000 });
  });

  it('prefers a valid Percentage Change over the absolute BTC price', () => {
    const result = resolvePriceScenarioInput(
      values({ btcPriceUsd: '60000', percentageChange: '0.1' }),
      portfolio(),
    );
    expect(result).toEqual({ type: 'percentageChange', percentageChange: 0.1 });
  });

  it('returns null when the absolute BTC price is invalid', () => {
    const result = resolvePriceScenarioInput(values({ btcPriceUsd: '-5' }), portfolio());
    expect(result).toBeNull();
  });

  it('returns null when Percentage Change is present but invalid', () => {
    const result = resolvePriceScenarioInput(values({ percentageChange: '-1' }), portfolio());
    expect(result).toBeNull();
  });
});

describe('resolveTimeHorizonDays', () => {
  it('resolves a fixed Holding Period option to its numeric day count', () => {
    expect(resolveTimeHorizonDays(values({ holdingPeriod: '90' }))).toBe(90);
  });

  it('resolves a valid custom Holding Period', () => {
    expect(
      resolveTimeHorizonDays(values({ holdingPeriod: 'custom', customHoldingPeriodDays: '45' })),
    ).toBe(45);
  });

  it('returns null for an invalid custom Holding Period', () => {
    expect(
      resolveTimeHorizonDays(values({ holdingPeriod: 'custom', customHoldingPeriodDays: '-1' })),
    ).toBeNull();
  });

  it('returns null for a non-integer custom Holding Period', () => {
    expect(
      resolveTimeHorizonDays(values({ holdingPeriod: 'custom', customHoldingPeriodDays: '1.5' })),
    ).toBeNull();
  });
});
