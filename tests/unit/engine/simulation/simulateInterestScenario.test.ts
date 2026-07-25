import { describe, expect, it } from 'vitest';

import type { PortfolioInput } from '@/engine/shared/types';
import {
  type InterestScenarioParams,
  simulateInterestScenario,
} from '@/engine/simulation/simulateInterestScenario';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseParams(overrides: Partial<InterestScenarioParams> = {}): InterestScenarioParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 50000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    timeHorizonDays: 15.5,
    borrowApr: 0.05,
    ...overrides,
  };
}

describe('simulateInterestScenario (M2-020, F-033)', () => {
  it('projects debt growth, equity, and Health Factor over a time horizon at an unchanged price', () => {
    const result = simulateInterestScenario(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-033');
    expect(result.value.scenarioBtcPriceUsd).toBe(60000);
    expect(result.value.accruedInterest).toBeCloseTo(106.164384, 5);
    expect(result.value.projectedDebt).toBeCloseTo(50106.164384, 5);
    expect(result.value.projectedCollateralValue).toBe(60000);
    expect(result.value.projectedEquity).toBeCloseTo(9893.835616, 5);
    expect(result.value.projectedHealthFactor).toBeCloseTo(0.957966, 6);
  });

  it('combines a price movement with interest accrual in one deterministic scenario, per the DoD', () => {
    const result = simulateInterestScenario(
      baseParams({ priceScenario: { type: 'percentageChange', percentageChange: 0.5 } }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.scenarioBtcPriceUsd).toBe(90000);
    expect(result.value.projectedCollateralValue).toBe(90000);
    expect(result.value.accruedInterest).toBeCloseTo(106.164384, 5);
  });

  it('returns unchanged projected debt for a zero-length time horizon', () => {
    const result = simulateInterestScenario(baseParams({ timeHorizonDays: 0 }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.accruedInterest).toBe(0);
      expect(result.value.projectedDebt).toBe(50000);
    }
  });

  it('propagates a failure from an invalid rate assumption', () => {
    const result = simulateInterestScenario(baseParams({ borrowApr: -0.01 }));
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from a negative time horizon', () => {
    const result = simulateInterestScenario(baseParams({ timeHorizonDays: -1 }));
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid price scenario', () => {
    const result = simulateInterestScenario(
      baseParams({ priceScenario: { type: 'percentageChange', percentageChange: -1 } }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from invalid collateral input', () => {
    const result = simulateInterestScenario(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: -1 },
          debt: { asset: 'USDC', balance: 50000 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid protocol liquidation threshold', () => {
    const result = simulateInterestScenario(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 1 },
          debt: { asset: 'USDC', balance: 50000 },
          market: { btcPriceUsd: 60000 },
          protocol: { ...protocol, liquidationThreshold: 1.5 },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });
});
