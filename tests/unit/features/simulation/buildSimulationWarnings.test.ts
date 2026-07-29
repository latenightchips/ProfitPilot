import { describe, expect, it } from 'vitest';

import { buildSimulationWarnings } from '@/features/simulation';
import type { Portfolio } from '@/types/portfolio';

/**
 * Simulation Warning builder — 06_TASKS.md M6-014 ("Implement
 * Simulation Warnings"). Only 2 of the 6 documented cases are covered —
 * see `../types/simulationWarnings.ts` for why the other 4 (near
 * liquidation, invalid assumptions, high leverage, high borrowing cost)
 * remain blocked or structurally unreachable.
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

describe('buildSimulationWarnings — no conditions active', () => {
  it('returns an empty array when no target is configured and the price is fresh', () => {
    const warnings = buildSimulationWarnings(basePortfolio(), 4);
    expect(warnings).toEqual([]);
  });

  it('returns an empty array when simulatedHealthFactor is null', () => {
    const warnings = buildSimulationWarnings(
      basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 2 } } }),
      null,
    );
    expect(warnings).toEqual([]);
  });
});

describe('buildSimulationWarnings — Unsafe Health Factor', () => {
  it('warns when the simulated Health Factor is below the configured target', () => {
    const portfolio = basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 2 } } });
    const warnings = buildSimulationWarnings(portfolio, 1.5);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('UNSAFE_HEALTH_FACTOR');
    expect(warnings[0].reason).toContain('1.5');
    expect(warnings[0].reason).toContain('2');
    expect(warnings[0].potentialImpact).toContain('liquidation');
  });

  it('does not warn when the simulated Health Factor is at or above the configured target', () => {
    const portfolio = basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 2 } } });
    expect(buildSimulationWarnings(portfolio, 2)).toEqual([]);
    expect(buildSimulationWarnings(portfolio, 3)).toEqual([]);
  });

  it('does not warn when no target Health Factor is configured', () => {
    const portfolio = basePortfolio();
    expect(buildSimulationWarnings(portfolio, 0.5)).toEqual([]);
  });
});

describe('buildSimulationWarnings — Stale prices', () => {
  it('warns when the portfolio price was last updated more than 5 minutes ago', () => {
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const portfolio = basePortfolio({ marketUpdatedAt: staleTimestamp });

    const warnings = buildSimulationWarnings(portfolio, 4);

    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('STALE_PRICES');
    expect(warnings[0].potentialImpact).toContain('outdated');
  });

  it('does not warn when the portfolio price was updated within the last 5 minutes', () => {
    const portfolio = basePortfolio({ marketUpdatedAt: new Date().toISOString() });
    expect(buildSimulationWarnings(portfolio, 4)).toEqual([]);
  });
});

describe('buildSimulationWarnings — both conditions active', () => {
  it('returns both warnings together', () => {
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetHealthFactor: 2 } },
      marketUpdatedAt: staleTimestamp,
    });

    const warnings = buildSimulationWarnings(portfolio, 1.5);

    expect(warnings.map((w) => w.code).sort()).toEqual(['STALE_PRICES', 'UNSAFE_HEALTH_FACTOR']);
  });
});
