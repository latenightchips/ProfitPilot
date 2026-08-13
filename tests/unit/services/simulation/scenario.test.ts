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

/**
 * Interest Cost comparison semantics — physical-testing report (PT-12
 * follow-up round 3). `debtCost` previously compared apples to oranges
 * for an interest scenario: the baseline side stayed the unprorated
 * *annual* figure (set up once, before either scenario branch, with no
 * time horizon in scope), while the scenario side was prorated to
 * `timeHorizonDays` — e.g. "$1,300 → $106.85" at a 30-day Holding
 * Period, reading as though the portfolio's own current cost were the
 * full annual figure. Both sides must represent the same Holding Period.
 * Portfolio: $26,000 debt, 5% Borrow APR (the report's own numbers) —
 * annual interest $1,300; 30/90/180/365-day prorated figures below are
 * the same `calculateProratedInterest` formula the interest-scenario
 * side already used, unmodified — this fix only makes the baseline call
 * it too, over the same time horizon.
 */
describe("simulateScenario — baseline Interest Cost matches the scenario's own Holding Period (PT-12 follow-up round 3)", () => {
  function debtPortfolio(): ApplicationPortfolio {
    return {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 26000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
  }

  it.each([
    [30, 106.85],
    [90, 320.55],
    [180, 641.1],
    [365, 1300],
  ])(
    'reprorates the baseline debtCost to a %i-day Holding Period, matching the scenario side ($%s)',
    (timeHorizonDays, expected) => {
      const scenario: SimulationScenario = {
        type: 'interest',
        priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
        timeHorizonDays,
        borrowApr: 0.05,
      };
      const result = simulateScenario(debtPortfolio(), scenario, `${timeHorizonDays} days`, 'live');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.baseline.debtCost).toBeCloseTo(expected, 2);
      expect(result.data.scenario.debtCost).toBeCloseTo(expected, 2);
      // Both sides represent the same Holding Period — no longer
      // "annual baseline vs. prorated scenario."
      expect(result.data.baseline.debtCost).toBeCloseTo(result.data.scenario.debtCost, 8);
    },
  );

  it('switching repeatedly between Holding Periods never leaves a stale baseline debtCost from a previous time horizon', () => {
    const priceScenario = { type: 'absolute' as const, btcPriceUsd: 50000 };
    const results = [30, 90, 30, 365, 180, 30].map((timeHorizonDays) =>
      simulateScenario(
        debtPortfolio(),
        { type: 'interest', priceScenario, timeHorizonDays, borrowApr: 0.05 },
        `${timeHorizonDays} days`,
        'live',
      ),
    );

    const expected = [106.85, 320.55, 106.85, 1300, 641.1, 106.85];
    results.forEach((result, index) => {
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.baseline.debtCost).toBeCloseTo(expected[index], 2);
      expect(result.data.scenario.debtCost).toBeCloseTo(expected[index], 2);
    });
  });

  it("reprorates using the debt value/rate actually on the portfolio today, not the scenario's own (possibly stress-tested) Borrow Rate", () => {
    // Scenario stress-tests a 10% Borrow Rate; the portfolio's own real,
    // current rate is still 5%. "Current Portfolio" must reflect today's
    // real cost, not the hypothetical rate being tested.
    const scenario: SimulationScenario = {
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 30,
      borrowApr: 0.1,
    };
    const result = simulateScenario(debtPortfolio(), scenario, '30 days at 10%', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Baseline: $26,000 * 5% * 30/365 ≈ $106.85 (today's real rate).
    expect(result.data.baseline.debtCost).toBeCloseTo(106.85, 2);
    // Scenario: $26,000 * 10% * 30/365 ≈ $213.70 (the stress-tested rate).
    expect(result.data.scenario.debtCost).toBeCloseTo(213.7, 2);
  });

  it("does not affect a type: 'price' scenario's baseline — both sides remain the annual figure, as before", () => {
    const scenario: SimulationScenario = {
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 40000 },
    };
    const result = simulateScenario(debtPortfolio(), scenario, 'Price drop', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.baseline.debtCost).toBeCloseTo(1300, 2);
    expect(result.data.scenario.debtCost).toBeCloseTo(1300, 2);
  });
});
