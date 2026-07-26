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

/**
 * Market Data Service — 06_TASKS.md M3-007. Verifies it is reachable
 * through the root `@/services` entry point, not just
 * `@/services/market`.
 */
describe('Public Service layer API surface (M3-007)', () => {
  it('normalizeMarketQuote is reachable through @/services alone', () => {
    expect(typeof (Services as Record<string, unknown>).normalizeMarketQuote).toBe('function');
  });

  it('a market quote can be normalized using only @/services imports', () => {
    const result = Services.normalizeMarketQuote({
      asset: 'BTC',
      currency: 'USD',
      candidates: [{ origin: 'provider', price: 65000, timestamp: '2026-01-01T00:00:00.000Z' }],
      now: '2026-01-01T00:01:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      asset: 'BTC',
      currency: 'USD',
      freshness: 'fresh',
      price: 65000,
      origin: 'provider',
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });
});

/**
 * Simulation Service — 06_TASKS.md M3-009. Verifies it is reachable
 * through the root `@/services` entry point, not just
 * `@/services/simulation`.
 */
describe('Public Service layer API surface (M3-009)', () => {
  it('simulateScenario is reachable through @/services alone', () => {
    expect(typeof (Services as Record<string, unknown>).simulateScenario).toBe('function');
  });

  it('a price scenario can be simulated using only @/services imports', () => {
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
    const result = Services.simulateScenario(
      portfolio,
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 40000 } },
      'Price drop',
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.scenario.equity).toBe(60000);
  });
});

/**
 * Recommendation Service — 06_TASKS.md M3-012. Verifies it is reachable
 * through the root `@/services` entry point, not just
 * `@/services/recommendation`.
 */
describe('Public Service layer API surface (M3-012)', () => {
  it('generateRecommendationSet is reachable through @/services alone', () => {
    expect(typeof (Services as Record<string, unknown>).generateRecommendationSet).toBe('function');
  });

  it('a recommendation set can be generated using only @/services imports', () => {
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
    const result = Services.generateRecommendationSet(
      portfolio,
      {
        borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 },
        repayment: { targetHealthFactor: 1.5 },
        additionalCollateral: { targetHealthFactor: 1.5 },
        loop: {
          targetHealthFactor: 1.5,
          loopBorrowPercentage: 0.5,
          maxAcceptableAnnualInterestCost: 5000,
        },
      },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recommendations).toHaveLength(4);
  });
});

/**
 * Loop Strategy Service — 06_TASKS.md M3-010. Verifies it is reachable
 * through the root `@/services` entry point, not just `@/services/loop`.
 */
describe('Public Service layer API surface (M3-010)', () => {
  it('planLoopStrategy is reachable through @/services alone', () => {
    expect(typeof (Services as Record<string, unknown>).planLoopStrategy).toBe('function');
  });

  it('a loop strategy can be planned using only @/services imports', () => {
    const portfolio = {
      collateral: { asset: 'BTC' as const, quantity: 1 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.5,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = Services.planLoopStrategy(
      portfolio,
      { targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(true);
  });
});

/**
 * Exit Planning Service — 06_TASKS.md M3-011. Verifies it is reachable
 * through the root `@/services` entry point, not just `@/services/exit`.
 */
describe('Public Service layer API surface (M3-011)', () => {
  it('planExit is reachable through @/services alone', () => {
    expect(typeof (Services as Record<string, unknown>).planExit).toBe('function');
  });

  it('an exit can be planned using only @/services imports', () => {
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
    const result = Services.planExit(portfolio, { type: 'debtBalance', targetDebt: 10000 }, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(true);
  });
});
