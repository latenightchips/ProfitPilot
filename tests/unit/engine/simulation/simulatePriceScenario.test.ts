import { describe, expect, it } from 'vitest';

import type { PortfolioInput } from '@/engine/shared/types';
import {
  type PriceScenarioParams,
  simulatePriceScenario,
} from '@/engine/simulation/simulatePriceScenario';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseParams(overrides: Partial<PriceScenarioParams> = {}): PriceScenarioParams {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 2.5 },
    debt: { asset: 'USDC', balance: 100000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    scenario: { type: 'absolute', btcPriceUsd: 90000 },
    ...overrides,
  };
}

describe('simulatePriceScenario (M2-019, F-050)', () => {
  it('matches the documented F-050 example and reconciles every output for an absolute price', () => {
    const result = simulatePriceScenario(baseParams());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-050');
    expect(result.value.scenarioBtcPriceUsd).toBe(90000);
    expect(result.value.collateralValue).toBe(225000); // F-050's own example
    expect(result.value.debtValue).toBe(100000); // unchanged
    expect(result.value.netEquity).toBe(125000);
    expect(result.value.loanToValue).toBeCloseTo(0.444444, 6);
    expect(result.value.healthFactor).toBe(1.8);
    expect(result.value.liquidationDistance).toBeCloseTo(0.8, 6);
    expect(result.value.profitOrLoss).toBe(75000); // 225,000 - 150,000
  });

  it('produces an identical result for an equivalent percentage-change scenario, per the DoD', () => {
    const absolute = simulatePriceScenario(baseParams());
    const percentage = simulatePriceScenario(
      baseParams({ scenario: { type: 'percentageChange', percentageChange: 0.5 } }),
    );
    expect(absolute.ok && percentage.ok).toBe(true);
    if (absolute.ok && percentage.ok) {
      expect(percentage.value).toEqual(absolute.value);
    }
  });

  it('reports a loss when the scenario price is below the current price', () => {
    const result = simulatePriceScenario(
      baseParams({ scenario: { type: 'percentageChange', percentageChange: -0.5 } }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.scenarioBtcPriceUsd).toBe(30000);
      expect(result.value.profitOrLoss).toBe(-75000);
    }
  });

  it('propagates a failure from an invalid scenario (price dropping to zero or below)', () => {
    const result = simulatePriceScenario(
      baseParams({ scenario: { type: 'percentageChange', percentageChange: -1 } }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from invalid collateral input', () => {
    const result = simulatePriceScenario(
      baseParams({
        portfolio: {
          collateral: { asset: 'BTC', quantity: -1 },
          debt: { asset: 'USDC', balance: 100000 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });
});
