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
  /**
   * These expected values reflect Aave V3's exact compounded variable-debt
   * accrual (`engine/protocols/aaveV3/`), not the generic simple-interest
   * formula (F-030/F-033) the Interest Scenario used before this batch.
   * Independently derived (Python + a standalone Node/BigInt script, see
   * `tests/unit/engine/protocols/aaveV3/math.test.ts`) for $20,000 debt @
   * 5% APR over 365 days: compounded factor 1.0512708333... ->
   * projectedDebt = 20000 * 1.0512708333... = 21025.41666... (vs. 21000
   * under the old simple-interest formula — a real, small, expected
   * divergence, not a regression).
   */
  it('computes a one-year interest accrual scenario at an unchanged price using Aave V3 compounded accrual', () => {
    const scenario: SimulationScenario = {
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 365,
      borrowApr: 0.05,
    };
    const result = simulateScenario(basePortfolio(), scenario, '1 year of interest', 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.scenario.debtCost).toBeCloseTo(1025.4167, 4);
    expect(result.data.scenario.equity).toBeCloseTo(78974.5833, 4);
    expect(result.data.scenario.healthFactor).toBeCloseTo(3.804919, 5);
    expect(result.data.scenario.liquidationDistance).toBeCloseTo(2.804919, 5);
    // Price unchanged: no profit or loss from interest accrual alone.
    expect(result.data.scenario.profitOrLoss).toBe(0);
    expect(result.data.scenario.leverage).toBeCloseTo(1.26623, 5);
  });

  it.each([
    [30, 82.3609, 20082.3609],
    [90, 248.1016, 20248.1016],
    [180, 499.2806, 20499.2806],
    [365, 1025.4167, 21025.4167],
    [800, 2316.2655, 22316.2655],
  ])(
    'projects %i days of compounded debt accrual at 5%% APR to the exact independently-derived value',
    (days, expectedDebtCost, expectedProjectedDebt) => {
      const scenario: SimulationScenario = {
        type: 'interest',
        priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
        timeHorizonDays: days,
        borrowApr: 0.05,
      };
      const result = simulateScenario(basePortfolio(), scenario, `${days} days`, 'live');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.scenario.debtCost).toBeCloseTo(expectedDebtCost, 3);
      // Collateral value is unchanged at $100,000 (price held at $50,000).
      expect(100000 - result.data.scenario.equity).toBeCloseTo(expectedProjectedDebt, 3);
    },
  );

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
    // debtCost (accrued interest) is price-independent — same compounded
    // value as the unchanged-price case above.
    expect(result.data.scenario.debtCost).toBeCloseTo(1025.4167, 4);
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
 * annual interest $1,300.
 *
 * Updated this batch: both sides now use `projectVariableDebt` (Aave V3
 * compounding, `engine/protocols/aaveV3/`) instead of the old
 * `calculateProratedInterest` (simple interest) — expected values below
 * are the independently-derived compounded figures, not the original
 * PT-12 report's simple-interest ones. The invariant the fix exists to
 * guarantee — baseline and scenario debtCost must match exactly when
 * both use the portfolio's own real current rate — still holds; it just
 * now holds for the compounded formula instead of the simple one.
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
    [30, 107.069169],
    [90, 322.532046],
    [180, 649.064776],
    [365, 1333.041667],
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

      expect(result.data.baseline.debtCost).toBeCloseTo(expected, 3);
      expect(result.data.scenario.debtCost).toBeCloseTo(expected, 3);
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

    const expected = [107.069169, 322.532046, 107.069169, 1333.041667, 649.064776, 107.069169];
    results.forEach((result, index) => {
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.baseline.debtCost).toBeCloseTo(expected[index], 3);
      expect(result.data.scenario.debtCost).toBeCloseTo(expected[index], 3);
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

    // Baseline: $26,000 compounded at 5% over 30 days ≈ $107.07 (today's real rate).
    expect(result.data.baseline.debtCost).toBeCloseTo(107.069169, 3);
    // Scenario: $26,000 compounded at 10% over 30 days ≈ $214.58 (the stress-tested rate).
    expect(result.data.scenario.debtCost).toBeCloseTo(214.57925, 3);
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

/**
 * Protocol/version dispatch — V4 Readiness Audit §12 Stage 1.
 * `simulateScenario` no longer imports `projectVariableDebt` from
 * `engine/protocols/aaveV3` directly; it resolves
 * `portfolio.protocolVersion ?? 'v3'` and calls `projectProtocolDebt`.
 * These tests prove that refactor is behavior-preserving for V3 (with and
 * without the field explicitly set — the "old persisted record" case has
 * no such field at all) and that a V4 portfolio fails closed rather than
 * silently reusing V3's math.
 */
describe('simulateScenario — protocol/version dispatch (V4 Readiness Audit §12 Stage 1)', () => {
  function debtPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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

  const interestScenario: SimulationScenario = {
    type: 'interest',
    priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
    timeHorizonDays: 365,
    borrowApr: 0.05,
  };

  describe('V3 regression — identical output through the new dispatch (representative scenarios)', () => {
    it('a portfolio with no protocolVersion field (an "old persisted record") still produces the exact V3 compounded value', () => {
      const result = simulateScenario(debtPortfolio(), interestScenario, '1 year', 'live');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Same exact expected value as the pre-existing, untouched "interest scenarios" suite above.
      expect(result.data.scenario.debtCost).toBeCloseTo(1025.4167, 4);
      expect(result.data.scenario.equity).toBeCloseTo(78974.5833, 4);
      expect(result.data.scenario.healthFactor).toBeCloseTo(3.804919, 5);
    });

    it('a portfolio with protocolVersion explicitly set to "v3" produces byte-identical results to one with the field omitted', () => {
      const withoutField = simulateScenario(debtPortfolio(), interestScenario, '1 year', 'live');
      const withField = simulateScenario(
        debtPortfolio({ protocolVersion: 'v3' }),
        interestScenario,
        '1 year',
        'live',
      );
      expect(withoutField.ok).toBe(true);
      expect(withField.ok).toBe(true);
      if (!withoutField.ok || !withField.ok) return;
      expect(withField.data.scenario).toEqual(withoutField.data.scenario);
      expect(withField.data.baseline).toEqual(withoutField.data.baseline);
    });

    it.each([
      [30, 82.3609, 20082.3609],
      [90, 248.1016, 20248.1016],
      [180, 499.2806, 20499.2806],
      [365, 1025.4167, 21025.4167],
      [800, 2316.2655, 22316.2655],
    ])(
      'reproduces the exact %i-day compounded-debt regression vector through the dispatch layer',
      (days, expectedDebtCost, expectedProjectedDebt) => {
        const scenario: SimulationScenario = {
          type: 'interest',
          priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
          timeHorizonDays: days,
          borrowApr: 0.05,
        };
        const result = simulateScenario(debtPortfolio(), scenario, `${days} days`, 'live');
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.data.scenario.debtCost).toBeCloseTo(expectedDebtCost, 3);
        expect(100000 - result.data.scenario.equity).toBeCloseTo(expectedProjectedDebt, 3);
      },
    );

    it('reproduces the exact PT-12 baseline-reproration regression vector through the dispatch layer', () => {
      const scenario: SimulationScenario = {
        type: 'interest',
        priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
        timeHorizonDays: 30,
        borrowApr: 0.05,
      };
      const result = simulateScenario(
        debtPortfolio({ debt: { asset: 'USDC', balance: 26000 } }),
        scenario,
        '30 days',
        'live',
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.baseline.debtCost).toBeCloseTo(107.069169, 3);
      expect(result.data.scenario.debtCost).toBeCloseTo(107.069169, 3);
    });

    it('a "price" scenario is unaffected by protocol version (does not call debt projection at all)', () => {
      const scenario: SimulationScenario = {
        type: 'price',
        priceScenario: { type: 'absolute', btcPriceUsd: 40000 },
      };
      const v3Result = simulateScenario(debtPortfolio(), scenario, 'Price drop', 'live');
      const v4Result = simulateScenario(
        debtPortfolio({ protocolVersion: 'v4' }),
        scenario,
        'Price drop',
        'live',
      );
      expect(v3Result.ok).toBe(true);
      expect(v4Result.ok).toBe(true);
      if (!v3Result.ok || !v4Result.ok) return;
      expect(v4Result.data.scenario).toEqual(v3Result.data.scenario);
    });
  });

  describe('V4 — fails closed, never silently falls back to V3 (unsupported this stage)', () => {
    it('an interest scenario on a protocolVersion: "v4" portfolio fails rather than returning a value', () => {
      const result = simulateScenario(
        debtPortfolio({ protocolVersion: 'v4' }),
        interestScenario,
        '1 year',
        'live',
      );
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toMatchObject({ code: 'AAVE_V4_PROJECTION_NOT_IMPLEMENTED' });
    });

    it('does not have a data field on the V4 failure result (no partial/placeholder result leaks through)', () => {
      const result = simulateScenario(
        debtPortfolio({ protocolVersion: 'v4' }),
        interestScenario,
        '1 year',
        'live',
      );
      expect(result.ok).toBe(false);
      expect('data' in result).toBe(false);
    });

    it('the V4 failure is not the same error a genuinely invalid V3 input would produce (a real, distinct unsupported-protocol error, not a coincidental validation failure)', () => {
      const v4Result = simulateScenario(
        debtPortfolio({ protocolVersion: 'v4' }),
        interestScenario,
        '1 year',
        'live',
      );
      const invalidV3Result = simulateScenario(
        debtPortfolio({ debt: { asset: 'USDC', balance: -1 } }),
        interestScenario,
        '1 year',
        'live',
      );
      expect(v4Result.ok).toBe(false);
      expect(invalidV3Result.ok).toBe(false);
      if (v4Result.ok || invalidV3Result.ok) return;
      expect(v4Result.errors[0]?.code).toBe('AAVE_V4_PROJECTION_NOT_IMPLEMENTED');
      expect(invalidV3Result.errors[0]?.code).not.toBe('AAVE_V4_PROJECTION_NOT_IMPLEMENTED');
    });
  });
});
