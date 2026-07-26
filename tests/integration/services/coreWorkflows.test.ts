import { describe, expect, it } from 'vitest';

import {
  calculatePortfolioSummary,
  generateRecommendationSet,
  mapPersistencePortfolioToApplicationPortfolio,
  normalizeMarketQuote,
  planExit,
  planLoopStrategy,
  simulateScenario,
} from '@/services';
import type { PersistencePortfolio } from '@/services/portfolio/models';

/**
 * Service Integration Tests — 06_TASKS.md M3-014 ("Create Service
 * Integration Tests"): "Test Service and Engine workflows together."
 * DoD: "Core workflows pass without external network calls."
 *
 * Unlike each Service's own unit tests (which construct an
 * `ApplicationPortfolio` directly and exercise one Service in
 * isolation), these tests chain real Services together starting from
 * raw `PersistencePortfolio` data — the same boundary-to-result path the
 * application will actually exercise — covering exactly 06_TASKS.md's
 * own 8-item "Cover" list, one `describe` block each, in order.
 *
 * The DoD ("...without external network calls") is satisfied
 * structurally: nothing in `services/` or `engine/` performs network
 * I/O anywhere (verified mechanically by
 * `tests/unit/services/serviceFoundation.test.ts`'s M3-013 check) — there
 * is no network call to avoid making, not something these tests need to
 * intercept or mock.
 */
function validPersistencePortfolio(): PersistencePortfolio {
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

describe('Cover: Valid portfolio summary (M3-014)', () => {
  it('maps a raw persistence portfolio and produces a complete summary in one workflow', () => {
    const mappingResult = mapPersistencePortfolioToApplicationPortfolio(
      validPersistencePortfolio(),
    );
    expect(mappingResult.ok).toBe(true);
    if (!mappingResult.ok) return;

    const summaryResult = calculatePortfolioSummary(mappingResult.data, 'live');
    expect(summaryResult.ok).toBe(true);
    if (!summaryResult.ok) return;

    expect(summaryResult.data).toEqual({
      collateralValue: 100000,
      debtValue: 20000,
      netEquity: 80000,
      loanToValue: 0.2,
      leverage: 1.25,
      healthFactor: 4,
      liquidation: { price: 12500, distance: 3, buffer: 75 },
      interestCost: 1000,
    });
  });
});

describe('Cover: Invalid portfolio (M3-014)', () => {
  it('rejects a malformed persistence portfolio before it ever reaches Portfolio Summary Service', () => {
    const mappingResult = mapPersistencePortfolioToApplicationPortfolio({});
    expect(mappingResult.ok).toBe(false);
    if (mappingResult.ok) return;
    expect(mappingResult.errors.length).toBeGreaterThan(0);
    expect(mappingResult.errors.every((error) => error.category === 'validation')).toBe(true);
  });

  it('rejects a persistence portfolio with an out-of-range value at the Engine boundary', () => {
    const invalid = validPersistencePortfolio();
    invalid.protocol = { ...invalid.protocol, liquidationThreshold: -1 };
    const mappingResult = mapPersistencePortfolioToApplicationPortfolio(invalid);
    // liquidationThreshold is not range-checked at the mapping boundary
    // (M3-004 only checks presence/finiteness), so mapping succeeds; the
    // out-of-range value is caught downstream when
    // calculatePortfolioSummary's Health Factor step runs.
    expect(mappingResult.ok).toBe(true);
    if (!mappingResult.ok) return;
    const summaryResult = calculatePortfolioSummary(mappingResult.data, 'live');
    expect(summaryResult.ok).toBe(false);
  });
});

describe('Cover: Manual market data (M3-014)', () => {
  it('normalizes a manually-entered price and feeds it into a portfolio summary', () => {
    const quoteResult = normalizeMarketQuote({
      asset: 'BTC',
      currency: 'USD',
      candidates: [{ origin: 'manual', price: 55000, timestamp: '2026-01-01T00:00:00.000Z' }],
      now: '2026-01-01T00:00:00.000Z',
    });
    expect(quoteResult.ok).toBe(true);
    if (!quoteResult.ok) return;
    expect(quoteResult.data.freshness).not.toBe('unavailable');
    if (quoteResult.data.freshness === 'unavailable') return;
    expect(quoteResult.data.origin).toBe('manual');

    const persistence = validPersistencePortfolio();
    persistence.market = { btcPriceUsd: quoteResult.data.price };
    const mappingResult = mapPersistencePortfolioToApplicationPortfolio(persistence);
    expect(mappingResult.ok).toBe(true);
    if (!mappingResult.ok) return;

    const summaryResult = calculatePortfolioSummary(mappingResult.data, 'manual');
    expect(summaryResult.ok).toBe(true);
    if (!summaryResult.ok) return;
    expect(summaryResult.data.collateralValue).toBe(110000);
    expect(summaryResult.data.healthFactor).toBe(4.4);
    expect(summaryResult.metadata.sourceStatus).toBe('manual');
  });
});

describe('Cover: Stale provider data (M3-014)', () => {
  it('labels a provider quote as stale but still allows the resulting portfolio to be summarized', () => {
    const quoteResult = normalizeMarketQuote({
      asset: 'BTC',
      currency: 'USD',
      candidates: [{ origin: 'provider', price: 60000, timestamp: '2026-01-01T00:00:00.000Z' }],
      now: '2026-01-01T00:10:00.000Z',
    });
    expect(quoteResult.ok).toBe(true);
    if (!quoteResult.ok) return;
    // 10 minutes old — older than the documented 5-minute threshold.
    expect(quoteResult.data.freshness).toBe('stale');
    if (quoteResult.data.freshness === 'unavailable') return;

    const persistence = validPersistencePortfolio();
    persistence.market = { btcPriceUsd: quoteResult.data.price };
    const mappingResult = mapPersistencePortfolioToApplicationPortfolio(persistence);
    expect(mappingResult.ok).toBe(true);
    if (!mappingResult.ok) return;

    // "Continue calculations only after clearly labeling the data as
    // stale" (04_BUILD_GUIDE.md "PRICE FRESHNESS") — the stale price is
    // still usable, not blocked.
    const summaryResult = calculatePortfolioSummary(mappingResult.data, 'live');
    expect(summaryResult.ok).toBe(true);
    if (!summaryResult.ok) return;
    expect(summaryResult.data.collateralValue).toBe(120000);
  });
});

describe('Cover: Simulation comparison (M3-014)', () => {
  it('maps a persistence portfolio and simulates a price-drop scenario against its baseline', () => {
    const mappingResult = mapPersistencePortfolioToApplicationPortfolio(
      validPersistencePortfolio(),
    );
    expect(mappingResult.ok).toBe(true);
    if (!mappingResult.ok) return;

    const result = simulateScenario(
      mappingResult.data,
      { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 40000 } },
      'BTC drops to $40,000',
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.baseline.equity).toBe(80000);
    expect(result.data.scenario.equity).toBe(60000);
    const equityDifference = result.data.comparison.differences.find((d) => d.metric === 'equity');
    expect(equityDifference?.difference).toBe(-20000);
  });
});

describe('Cover: Unsafe loop strategy (M3-014)', () => {
  it('maps a near-liquidation persistence portfolio and reports the strategy as non-viable', () => {
    const atLiquidation: PersistencePortfolio = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 9000 },
      market: { btcPriceUsd: 10000 },
      protocol: {
        maxLoanToValue: 0.5,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const mappingResult = mapPersistencePortfolioToApplicationPortfolio(atLiquidation);
    expect(mappingResult.ok).toBe(true);
    if (!mappingResult.ok) return;

    const result = planLoopStrategy(
      mappingResult.data,
      { targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 },
      'live',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(false);
    expect(result.data.strategy).toBeNull();
    expect(result.data.findings).toContainEqual(
      expect.objectContaining({ check: 'LIQUIDATION_PROXIMITY', severity: 'error' }),
    );
  });
});

describe('Cover: Infeasible exit target (M3-014)', () => {
  it('maps a persistence portfolio and reports an over-target exit as infeasible', () => {
    const mappingResult = mapPersistencePortfolioToApplicationPortfolio(
      validPersistencePortfolio(),
    );
    expect(mappingResult.ok).toBe(true);
    if (!mappingResult.ok) return;

    const result = planExit(mappingResult.data, { type: 'debtBalance', targetDebt: 30000 }, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.feasible).toBe(false);
    expect(typeof result.data.infeasibleReason).toBe('string');
    expect(result.data.after).toBeNull();
  });
});

describe('Cover: Recommendation generation (M3-014)', () => {
  it('maps a persistence portfolio and generates a full, ranked recommendation set', () => {
    const mappingResult = mapPersistencePortfolioToApplicationPortfolio(
      validPersistencePortfolio(),
    );
    expect(mappingResult.ok).toBe(true);
    if (!mappingResult.ok) return;

    const result = generateRecommendationSet(
      mappingResult.data,
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
    expect(result.data.unavailableCategories.length).toBeGreaterThan(0);
  });
});
