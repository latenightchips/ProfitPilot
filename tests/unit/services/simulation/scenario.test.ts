import { describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services/portfolio/models';
import type { SimulationScenario } from '@/services/simulation/scenario';
import { simulateScenario } from '@/services/simulation/scenario';

/**
 * Simulation Service — 06_TASKS.md M3-009.
 *
 * Same base portfolio as `services/portfolio`'s own tests (2 BTC @
 * $50,000, $20,000 debt, 75%/80% LTV/liquidation-threshold, 5%/2%
 * borrow/supply APR), so the baseline `ScenarioSummary` is already known:
 * equity 80000, healthFactor 4, liquidationDistance 3, debtCost 1000,
 * leverage 1.25.
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

describe('simulateScenario — price scenarios (M3-009)', () => {
  it('computes a price-drop scenario and compares it against the baseline', () => {
    const scenario: SimulationScenario = {
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 40000 },
    };
    const result = simulateScenario(basePortfolio(), scenario, 'BTC drops to $40,000', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.baseline).toEqual({
      label: 'Current Portfolio',
      equity: 80000,
      profitOrLoss: 0,
      healthFactor: 4,
      liquidationDistance: 3,
      debtCost: 1000,
      leverage: 1.25,
    });

    expect(result.data.scenario.label).toBe('BTC drops to $40,000');
    expect(result.data.scenario.equity).toBe(60000);
    expect(result.data.scenario.profitOrLoss).toBe(-20000);
    expect(result.data.scenario.healthFactor).toBe(3.2);
    expect(result.data.scenario.liquidationDistance).toBe(2.2);
    expect(result.data.scenario.debtCost).toBe(1000);
    expect(result.data.scenario.leverage).toBeCloseTo(1.333333, 6);
  });

  it('reports a zero-debt baseline liquidationDistance as Infinity rather than failing (conflict #20 resolved)', () => {
    const debtFree: ApplicationPortfolio = {
      ...basePortfolio(),
      debt: { asset: 'USDC', balance: 0 },
    };
    const scenario: SimulationScenario = {
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 40000 },
    };
    const result = simulateScenario(debtFree, scenario, 'BTC drops to $40,000', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.baseline.liquidationDistance).toBe(Infinity);
    expect(result.data.baseline.healthFactor).toBe(Infinity);
  });

  it('produces a comparison-ready result via compareScenarios', () => {
    const scenario: SimulationScenario = {
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 40000 },
    };
    const result = simulateScenario(basePortfolio(), scenario, 'Price drop', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.comparison.scenarioALabel).toBe('Current Portfolio');
    expect(result.data.comparison.scenarioBLabel).toBe('Price drop');
    const equityDifference = result.data.comparison.differences.find((d) => d.metric === 'equity');
    expect(equityDifference?.difference).toBe(-20000);
  });

  it('supports percentage-change price scenarios', () => {
    const scenario: SimulationScenario = {
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -0.2 },
    };
    const result = simulateScenario(basePortfolio(), scenario, '20% drop', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.scenario.equity).toBe(60000);
  });

  it('preserves the caller-supplied scenario definition as "assumptions"', () => {
    const scenario: SimulationScenario = {
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 40000 },
    };
    const result = simulateScenario(basePortfolio(), scenario, 'Price drop', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.assumptions).toEqual(scenario);
  });

  it('threads sourceStatus through to metadata', () => {
    const scenario: SimulationScenario = {
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 40000 },
    };
    const result = simulateScenario(basePortfolio(), scenario, 'Price drop', 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sourceStatus).toBe('manual');
  });

  it('propagates an Engine failure (invalid portfolio) as a single ApplicationError', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...basePortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    const scenario: SimulationScenario = {
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 40000 },
    };
    const result = simulateScenario(invalidPortfolio, scenario, 'Price drop', 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'INVALID_NON_NEGATIVE' });
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const scenario: SimulationScenario = {
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: -1 },
    };
    const result = simulateScenario(basePortfolio(), scenario, 'Invalid', 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });
});

describe('simulateScenario — interest scenarios (M3-009)', () => {
  it('computes a one-year interest accrual scenario at an unchanged price', () => {
    const scenario: SimulationScenario = {
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 365,
      borrowApr: 0.05,
    };
    const result = simulateScenario(basePortfolio(), scenario, '1 year of interest', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.scenario.debtCost).toBe(1000);
    expect(result.data.scenario.equity).toBe(79000);
    expect(result.data.scenario.healthFactor).toBeCloseTo(3.809524, 5);
    expect(result.data.scenario.liquidationDistance).toBeCloseTo(2.809524, 5);
    // Price unchanged: no profit or loss from interest accrual alone.
    expect(result.data.scenario.profitOrLoss).toBe(0);
    expect(result.data.scenario.leverage).toBeCloseTo(1.265823, 5);
  });

  it('combines a price movement with interest accrual in one scenario', () => {
    const scenario: SimulationScenario = {
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 40000 },
      timeHorizonDays: 365,
      borrowApr: 0.05,
    };
    const result = simulateScenario(basePortfolio(), scenario, 'Price drop + 1yr interest', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Collateral value at $40,000: 80000; baseline collateral value: 100000.
    expect(result.data.scenario.profitOrLoss).toBe(-20000);
    expect(result.data.scenario.debtCost).toBe(1000);
  });

  it('preserves the time horizon and rate as part of "assumptions"', () => {
    const scenario: SimulationScenario = {
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 30,
      borrowApr: 0.06,
    };
    const result = simulateScenario(basePortfolio(), scenario, '30 days', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.assumptions).toEqual(scenario);
  });

  it('propagates an Engine failure (negative time horizon) as a single ApplicationError', () => {
    const scenario: SimulationScenario = {
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: -1,
      borrowApr: 0.05,
    };
    const result = simulateScenario(basePortfolio(), scenario, 'Invalid horizon', 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
  });
});
