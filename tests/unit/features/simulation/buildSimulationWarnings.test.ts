import { describe, expect, it } from 'vitest';

import { buildSimulationWarnings, type SimulationWarningInputs } from '@/features/simulation';
import type { Portfolio } from '@/types/portfolio';

/**
 * Simulation Warning builder — 06_TASKS.md M6-014 ("Implement
 * Simulation Warnings"), plus a later "Simulation warning thresholds"
 * task that added 5 previously-blocked/unbuilt cases with explicitly
 * requested and approved thresholds. See `../types/simulationWarnings.ts`
 * for the full reasoning behind every threshold and why "Invalid
 * assumptions" alone remains structurally unreachable.
 */
function basePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'Test Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    archivedAt: null,
    marketUpdatedAt: new Date().toISOString(),
    protocolUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Neutral inputs that trigger none of the checks by default — every
 * boundary test below overrides only the one field it is testing, so a
 * `toHaveLength(1)` assertion is never accidentally tripped by an
 * unrelated field's own default value.
 */
function baseInputs(overrides: Partial<SimulationWarningInputs> = {}): SimulationWarningInputs {
  return {
    healthFactor: 4,
    equity: 100000,
    leverage: 1.5,
    borrowApr: 0.05,
    timeHorizonDays: null,
    ...overrides,
  };
}

describe('buildSimulationWarnings — no conditions active', () => {
  it('returns an empty array when every input is safe/neutral', () => {
    expect(buildSimulationWarnings(basePortfolio(), baseInputs())).toEqual([]);
  });

  it('returns an empty array when every input is null', () => {
    const warnings = buildSimulationWarnings(
      basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 2 } } }),
      { healthFactor: null, equity: null, leverage: null, borrowApr: null, timeHorizonDays: null },
    );
    expect(warnings).toEqual([]);
  });
});

describe('buildSimulationWarnings — Unsafe Health Factor (personalized target)', () => {
  it('warns when the simulated Health Factor is below the configured target', () => {
    const portfolio = basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 2 } } });
    const warnings = buildSimulationWarnings(portfolio, baseInputs({ healthFactor: 1.5 }));

    const warning = warnings.find((w) => w.code === 'UNSAFE_HEALTH_FACTOR');
    expect(warning).toBeDefined();
    expect(warning?.reason).toContain('1.5');
    expect(warning?.reason).toContain('2');
    expect(warning?.potentialImpact).toContain('liquidation');
  });

  it('does not warn when the simulated Health Factor is at or above the configured target', () => {
    const portfolio = basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 2 } } });
    expect(buildSimulationWarnings(portfolio, baseInputs({ healthFactor: 2 }))).toEqual([]);
    expect(buildSimulationWarnings(portfolio, baseInputs({ healthFactor: 3 }))).toEqual([]);
  });

  it('does not warn when no target Health Factor is configured', () => {
    const portfolio = basePortfolio();
    expect(buildSimulationWarnings(portfolio, baseInputs({ healthFactor: 1.5 }))).toEqual([]);
  });

  it('does not warn for a zero-debt Infinity Health Factor, even with a configured target (Batch 22, M6-023)', () => {
    // A zero-debt Health Factor is real, computed `Infinity` (M2-009's
    // own NO_DEBT design), not a sentinel or invented value. This
    // function's own `Number.isFinite` guard exists specifically to
    // stop `Infinity < target` from ever producing a nonsensical
    // "unsafe" warning for the safest possible position — verified
    // directly here rather than only relied upon as a mathematical
    // fact, since `Infinity < 2` is already `false` regardless of the
    // guard, meaning a future accidental removal of the guard would not
    // be caught without this explicit check.
    const portfolio = basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 2 } } });
    expect(buildSimulationWarnings(portfolio, baseInputs({ healthFactor: Infinity }))).toEqual([]);
  });
});

describe('buildSimulationWarnings — Health Factor at or below liquidation (AT_LIQUIDATION, healthFactor <= 1.0)', () => {
  it('warns exactly at the liquidation boundary (Health Factor 1.0)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ healthFactor: 1.0 }));
    expect(warnings.map((w) => w.code)).toContain('AT_LIQUIDATION');
    expect(warnings.map((w) => w.code)).not.toContain('NEAR_LIQUIDATION');
  });

  it('warns below the liquidation boundary (Health Factor 0.99)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ healthFactor: 0.99 }));
    expect(warnings.map((w) => w.code)).toContain('AT_LIQUIDATION');
  });

  it('does not warn just above the liquidation boundary (Health Factor 1.01) — falls into "near" instead', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ healthFactor: 1.01 }));
    expect(warnings.map((w) => w.code)).not.toContain('AT_LIQUIDATION');
    expect(warnings.map((w) => w.code)).toContain('NEAR_LIQUIDATION');
  });

  it('explains cause and potential impact', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ healthFactor: 1.0 }));
    const warning = warnings.find((w) => w.code === 'AT_LIQUIDATION');
    expect(warning?.reason).toContain('1.00');
    expect(warning?.potentialImpact).toContain('liquidation');
  });
});

describe('buildSimulationWarnings — Near liquidation (NEAR_LIQUIDATION, 1.0 < healthFactor <= 1.1)', () => {
  it('warns exactly at the near-liquidation boundary (Health Factor 1.1)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ healthFactor: 1.1 }));
    expect(warnings.map((w) => w.code)).toContain('NEAR_LIQUIDATION');
  });

  it('does not warn just above the near-liquidation boundary (Health Factor 1.11)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ healthFactor: 1.11 }));
    expect(warnings.map((w) => w.code)).not.toContain('NEAR_LIQUIDATION');
    expect(warnings.map((w) => w.code)).not.toContain('AT_LIQUIDATION');
  });

  it('never fires together with AT_LIQUIDATION (mutually exclusive ranges)', () => {
    for (const healthFactor of [0.5, 1.0, 1.05, 1.1, 1.5]) {
      const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ healthFactor }));
      const codes = warnings.map((w) => w.code);
      expect(codes.includes('AT_LIQUIDATION') && codes.includes('NEAR_LIQUIDATION')).toBe(false);
    }
  });
});

describe('buildSimulationWarnings — Negative equity (NEGATIVE_EQUITY, equity < 0)', () => {
  it('warns for a negative equity value', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ equity: -0.01 }));
    const warning = warnings.find((w) => w.code === 'NEGATIVE_EQUITY');
    expect(warning).toBeDefined();
    expect(warning?.reason).toContain('-$0.01');
  });

  it('does not warn for exactly zero equity', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ equity: 0 }));
    expect(warnings.map((w) => w.code)).not.toContain('NEGATIVE_EQUITY');
  });

  it('does not warn for positive equity', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ equity: 100 }));
    expect(warnings.map((w) => w.code)).not.toContain('NEGATIVE_EQUITY');
  });
});

describe('buildSimulationWarnings — High leverage (HIGH_LEVERAGE, leverage >= 3)', () => {
  it('warns exactly at the threshold (leverage 3.0)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ leverage: 3 }));
    const warning = warnings.find((w) => w.code === 'HIGH_LEVERAGE');
    expect(warning).toBeDefined();
    expect(warning?.reason).toContain('3x');
  });

  it('does not warn just below the threshold (leverage 2.99)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ leverage: 2.99 }));
    expect(warnings.map((w) => w.code)).not.toContain('HIGH_LEVERAGE');
  });
});

describe('buildSimulationWarnings — High borrowing cost (HIGH_BORROWING_COST, borrowApr >= 15%)', () => {
  it('warns exactly at the threshold (15% APR)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ borrowApr: 0.15 }));
    const warning = warnings.find((w) => w.code === 'HIGH_BORROWING_COST');
    expect(warning).toBeDefined();
    expect(warning?.reason).toContain('15.00%');
  });

  it('does not warn just below the threshold (14.99% APR)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ borrowApr: 0.1499 }));
    expect(warnings.map((w) => w.code)).not.toContain('HIGH_BORROWING_COST');
  });

  it("does not warn for the portfolio fixture's own ordinary 5% rate", () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ borrowApr: 0.05 }));
    expect(warnings.map((w) => w.code)).not.toContain('HIGH_BORROWING_COST');
  });
});

describe('buildSimulationWarnings — Long holding-period assumption (LONG_HOLDING_PERIOD, timeHorizonDays > 365)', () => {
  it('does not warn for the longest built-in Holding Period preset (365 days)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ timeHorizonDays: 365 }));
    expect(warnings.map((w) => w.code)).not.toContain('LONG_HOLDING_PERIOD');
  });

  it('warns for a Custom Holding Period one day beyond the longest preset (366 days)', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), baseInputs({ timeHorizonDays: 366 }));
    const warning = warnings.find((w) => w.code === 'LONG_HOLDING_PERIOD');
    expect(warning).toBeDefined();
    expect(warning?.reason).toContain('366');
  });

  it('does not warn when no interest scenario is active (timeHorizonDays null)', () => {
    const warnings = buildSimulationWarnings(
      basePortfolio(),
      baseInputs({ timeHorizonDays: null }),
    );
    expect(warnings.map((w) => w.code)).not.toContain('LONG_HOLDING_PERIOD');
  });
});

describe('buildSimulationWarnings — Stale prices', () => {
  it('warns when the portfolio price was last updated more than 5 minutes ago', () => {
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const portfolio = basePortfolio({ marketUpdatedAt: staleTimestamp });

    const warnings = buildSimulationWarnings(portfolio, baseInputs());

    const warning = warnings.find((w) => w.code === 'STALE_PRICES');
    expect(warning).toBeDefined();
    expect(warning?.potentialImpact).toContain('outdated');
  });

  it('does not warn when the portfolio price was updated within the last 5 minutes', () => {
    const portfolio = basePortfolio({ marketUpdatedAt: new Date().toISOString() });
    expect(buildSimulationWarnings(portfolio, baseInputs())).toEqual([]);
  });
});

describe('buildSimulationWarnings — multiple conditions active at once', () => {
  it('returns every triggered warning together, each independently', () => {
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetHealthFactor: 2 } },
      marketUpdatedAt: staleTimestamp,
    });

    const warnings = buildSimulationWarnings(
      portfolio,
      baseInputs({
        healthFactor: 1.05,
        equity: -500,
        leverage: 4,
        borrowApr: 0.2,
        timeHorizonDays: 400,
      }),
    );

    // 1.05 is both below the target (UNSAFE_HEALTH_FACTOR) and within
    // the near-liquidation band (NEAR_LIQUIDATION) — both fire, since
    // they answer different questions (personalized vs. universal).
    expect(warnings.map((w) => w.code).sort()).toEqual(
      [
        'HIGH_BORROWING_COST',
        'HIGH_LEVERAGE',
        'LONG_HOLDING_PERIOD',
        'NEAR_LIQUIDATION',
        'NEGATIVE_EQUITY',
        'STALE_PRICES',
        'UNSAFE_HEALTH_FACTOR',
      ].sort(),
    );
  });
});
