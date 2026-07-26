import { describe, expect, it } from 'vitest';

import * as Services from '@/services';

/**
 * Service layer public API surface — 06_TASKS.md M3-002/M3-003.
 *
 * Mirrors `tests/unit/engine/publicApiSurface.test.ts`'s pattern one
 * layer up: verifies the Standard Service Result Model and Application
 * Error Model are actually reachable through the root `@/services`
 * entry point (not just their own submodule path), the same DoD
 * `services/index.ts` exists to satisfy.
 */
describe('Public Service layer API surface (M3-002, M3-003)', () => {
  const expectedFunctionNames = [
    'createServiceSuccess',
    'createServiceFailure',
    'createApplicationError',
  ];

  it.each(expectedFunctionNames)('%s is reachable through @/services alone', (name) => {
    expect(typeof (Services as Record<string, unknown>)[name]).toBe('function');
  });

  it('a success and failure ServiceResult can be built using only @/services imports', () => {
    const options = { sourceStatus: 'live', engineVersion: '0.1.0', formulaVersion: '1.0' };

    const success = Services.createServiceSuccess({ ok: true }, options);
    expect(success.ok).toBe(true);

    const failure = Services.createServiceFailure(
      [Services.createApplicationError('validation', 'X', 'Invalid input.')],
      options,
    );
    expect(failure.ok).toBe(false);
  });
});

/**
 * Portfolio Mapping Utilities — 06_TASKS.md M3-004. Verifies the mapping
 * functions are reachable through the root `@/services` entry point, not
 * just `@/services/portfolio`.
 */
describe('Public Service layer API surface (M3-004)', () => {
  const expectedFunctionNames = [
    'mapPersistencePortfolioToApplicationPortfolio',
    'mapApplicationPortfolioToEngineInput',
  ];

  it.each(expectedFunctionNames)('%s is reachable through @/services alone', (name) => {
    expect(typeof (Services as Record<string, unknown>)[name]).toBe('function');
  });

  it('a full mapping round-trip can be performed using only @/services imports', () => {
    const persistenceResult = Services.mapPersistencePortfolioToApplicationPortfolio({
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 1000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.8,
        liquidationThreshold: 0.83,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(persistenceResult.ok).toBe(true);
    if (!persistenceResult.ok) return;

    const engineInput = Services.mapApplicationPortfolioToEngineInput(persistenceResult.data);
    expect(engineInput.collateral.asset).toBe('BTC');
  });
});

/**
 * Portfolio Summary + Action Preview Services — 06_TASKS.md M3-005,
 * M3-006. Verifies both are reachable through the root `@/services`
 * entry point, not just `@/services/portfolio`.
 */
describe('Public Service layer API surface (M3-005, M3-006)', () => {
  const expectedFunctionNames = ['calculatePortfolioSummary', 'previewPortfolioAction'];

  it.each(expectedFunctionNames)('%s is reachable through @/services alone', (name) => {
    expect(typeof (Services as Record<string, unknown>)[name]).toBe('function');
  });

  it('a full summary and action preview can be computed using only @/services imports', () => {
    const portfolio = {
      collateral: { asset: 'BTC' as const, quantity: 2 },
      debt: { asset: 'USDC', balance: 20000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };

    const summaryResult = Services.calculatePortfolioSummary(portfolio, 'live');
    expect(summaryResult.ok).toBe(true);
    if (!summaryResult.ok) return;
    expect(summaryResult.data.collateralValue).toBe(100000);

    const previewResult = Services.previewPortfolioAction(
      portfolio,
      { type: 'addCollateral', quantity: 1 },
      'live',
    );
    expect(previewResult.ok).toBe(true);
    if (!previewResult.ok) return;
    expect(previewResult.data.after.collateralValue).toBe(150000);
  });
});
