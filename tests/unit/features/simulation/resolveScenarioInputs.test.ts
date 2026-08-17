import { describe, expect, it } from 'vitest';

import type { ScenarioBuilderFormValues } from '@/features/simulation';
import {
  resolveInterestScenario,
  resolvePriceScenarioInput,
  resolveTimeHorizonDays,
} from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';

/**
 * Scenario Builder input resolution — 06_TASKS.md M6-006 ("Implement
 * Interest Rate Simulation") + M6-007 ("Implement Time Projection").
 * These pure helpers turn the Scenario Builder's current form state
 * into the `PriceScenarioInput`/`timeHorizonDays` pieces an interest
 * scenario needs alongside Borrow Rate, and `resolveInterestScenario`
 * combines all three into one complete `SimulationScenario`.
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
    borrowApr: '5',
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
      values({ btcPriceUsd: '60000', percentageChange: '10' }),
      portfolio(),
    );
    expect(result).toEqual({ type: 'percentageChange', percentageChange: 0.1 });
  });

  it('returns null when the absolute BTC price is invalid', () => {
    const result = resolvePriceScenarioInput(values({ btcPriceUsd: '-5' }), portfolio());
    expect(result).toBeNull();
  });

  it('returns null when Percentage Change is present but invalid', () => {
    const result = resolvePriceScenarioInput(values({ percentageChange: '-100' }), portfolio());
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

describe('resolveInterestScenario', () => {
  it('combines Borrow Rate, the resolved price, and the resolved time horizon', () => {
    const result = resolveInterestScenario(
      values({ borrowApr: '10', holdingPeriod: '90' }),
      portfolio(),
      true,
    );
    expect(result).toEqual({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 90,
      borrowApr: 0.1,
    });
  });

  it('uses a valid Percentage Change over the absolute price, same as resolvePriceScenarioInput', () => {
    const result = resolveInterestScenario(
      values({ borrowApr: '8', percentageChange: '20' }),
      portfolio(),
      true,
    );
    expect(result).toMatchObject({
      priceScenario: { type: 'percentageChange', percentageChange: 0.2 },
    });
  });

  it('returns null when Borrow Rate is invalid', () => {
    const result = resolveInterestScenario(values({ borrowApr: '-1' }), portfolio(), true);
    expect(result).toBeNull();
  });

  it('returns null when the price side is invalid', () => {
    const result = resolveInterestScenario(values({ btcPriceUsd: '-5' }), portfolio(), true);
    expect(result).toBeNull();
  });

  it('returns null when the custom Holding Period is invalid', () => {
    const result = resolveInterestScenario(
      values({ holdingPeriod: 'custom', customHoldingPeriodDays: '-1' }),
      portfolio(),
      true,
    );
    expect(result).toBeNull();
  });

  it('a V3 (or unset) portfolio never carries v4RateStress, regardless of borrowAprEstablished', () => {
    const established = resolveInterestScenario(values({ borrowApr: '10' }), portfolio(), true);
    const unestablished = resolveInterestScenario(values({ borrowApr: '10' }), portfolio(), false);
    expect(established).toEqual(unestablished);
    expect(established).not.toHaveProperty('v4RateStress');
  });
});

/**
 * V4 rate stress — V4 Readiness Audit §12 Stage 20. `scenario.borrowApr`
 * remains V3-only and unconditionally set from the form's own value
 * (unchanged); `services/simulation/scenario.ts`'s V4 branch reads
 * `v4RateStress` instead, only populated once the field has been
 * genuinely established — see `ScenarioBuilder.tsx`'s own header comment.
 * Every test below uses deliberately different values for
 * `portfolio.protocol.borrowApr` / `v4DebtState.baseDrawnApr` /
 * `v4DebtState.riskPremium` so an accidental legacy-field read or a
 * risk-premium mixup would be directly observable.
 */
describe('resolveInterestScenario — V4 rate stress (Stage 20)', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return portfolio({
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.99, // deliberately unrelated — must never leak into v4RateStress
        supplyApr: 0.02,
      },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
      ...overrides,
    });
  }

  it('omits v4RateStress entirely while borrowAprEstablished is false, even though a numeric Borrow Rate is present', () => {
    const result = resolveInterestScenario(values({ borrowApr: '5.37' }), v4Portfolio(), false);
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('v4RateStress');
  });

  it('sets v4RateStress.baseDrawnApr to exactly the typed value once established — never portfolio.protocol.borrowApr, never the blended effective rate', () => {
    const result = resolveInterestScenario(values({ borrowApr: '8' }), v4Portfolio(), true);
    expect(result).not.toBeNull();
    if (result === null || result.type !== 'interest') return;
    expect(result.v4RateStress).toEqual({ baseDrawnApr: 0.08, riskPremium: 0.1 });
    expect(result.v4RateStress?.baseDrawnApr).not.toBe(0.99);
  });

  it('carries riskPremium from the real current v4DebtState, unchanged, applied exactly once (never derived from the typed rate)', () => {
    const result = resolveInterestScenario(
      values({ borrowApr: '20' }),
      v4Portfolio({
        v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.33 },
      }),
      true,
    );
    expect(result).not.toBeNull();
    if (result === null || result.type !== 'interest') return;
    expect(result.v4RateStress?.riskPremium).toBe(0.33);
  });

  it('still sets scenario.borrowApr from the form value (V3-only field, harmlessly unread by the V4 branch)', () => {
    const result = resolveInterestScenario(values({ borrowApr: '8' }), v4Portfolio(), true);
    expect(result).not.toBeNull();
    if (result === null || result.type !== 'interest') return;
    expect(result.borrowApr).toBe(0.08);
  });

  it('omits v4RateStress when v4DebtState has not synced yet, even once established (no ambiguous/fabricated stress)', () => {
    const noState = v4Portfolio({ v4DebtState: undefined });
    const result = resolveInterestScenario(values({ borrowApr: '8' }), noState, true);
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty('v4RateStress');
  });
});
