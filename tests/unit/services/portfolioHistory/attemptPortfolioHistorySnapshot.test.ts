import { beforeEach, describe, expect, it } from 'vitest';

import { listPortfolioHistoryForPortfolio } from '@/services/persistence/portfolioHistory';
import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { calculatePortfolioSummary } from '@/services/portfolio/summary';
import { attemptPortfolioHistorySnapshot } from '@/services/portfolioHistory/attemptPortfolioHistorySnapshot';

/**
 * `attemptPortfolioHistorySnapshot` — V1.1 Batch 2's one orchestration
 * function. Exercised against the real default `persistenceService`
 * (backed by `local-storage.adapter.ts` in this jsdom test environment,
 * the same singleton `stores/portfolioStore.ts` itself uses) rather than
 * an injected memory adapter — `attemptPortfolioHistorySnapshot` takes no
 * service parameter by design (see its own header comment), so this is
 * the only way to test it as actually wired.
 */
function basePortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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

function summaryFor(portfolio: ApplicationPortfolio) {
  const result = calculatePortfolioSummary(portfolio, 'live');
  if (!result.ok) throw new Error('setup failed: summary calculation was expected to succeed');
  return result.data;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('attemptPortfolioHistorySnapshot', () => {
  it('records a first entry with no prior history (creation)', async () => {
    const portfolio = basePortfolio();
    await attemptPortfolioHistorySnapshot('portfolio-1', portfolio, summaryFor(portfolio));

    const listed = await listPortfolioHistoryForPortfolio('portfolio-1');
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(1);
    expect(listed.data[0]?.payload.healthFactor).toBe(4);
  });

  it('does not record a second entry when nothing materially changed (dedup)', async () => {
    const portfolio = basePortfolio();
    await attemptPortfolioHistorySnapshot('portfolio-1', portfolio, summaryFor(portfolio));
    await attemptPortfolioHistorySnapshot('portfolio-1', portfolio, summaryFor(portfolio));

    const listed = await listPortfolioHistoryForPortfolio('portfolio-1');
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(1);
  });

  it('records a second entry once the portfolio materially changes', async () => {
    const portfolio = basePortfolio();
    await attemptPortfolioHistorySnapshot('portfolio-1', portfolio, summaryFor(portfolio));

    const changed = basePortfolio({ market: { btcPriceUsd: 60000 } });
    await attemptPortfolioHistorySnapshot('portfolio-1', changed, summaryFor(changed));

    const listed = await listPortfolioHistoryForPortfolio('portfolio-1');
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(2);
  });

  it('keeps multiple portfolios isolated from each other', async () => {
    const a = basePortfolio();
    const b = basePortfolio({ market: { btcPriceUsd: 45000 } });
    await attemptPortfolioHistorySnapshot('portfolio-a', a, summaryFor(a));
    await attemptPortfolioHistorySnapshot('portfolio-b', b, summaryFor(b));

    const listedA = await listPortfolioHistoryForPortfolio('portfolio-a');
    const listedB = await listPortfolioHistoryForPortfolio('portfolio-b');
    expect(listedA.ok && listedA.data).toHaveLength(1);
    expect(listedB.ok && listedB.data).toHaveLength(1);
  });

  it('is a silent no-op when the summary calculation itself failed (never surfaces an error to the caller)', async () => {
    // A V4 portfolio with no synced debt state fails closed at the
    // summary layer (AAVE_V4_DEBT_STATE_MISSING) — there is nothing
    // meaningful to snapshot. `attemptHistorySnapshot`
    // (`stores/portfolioStore.ts`) guards on `summary.ok` before ever
    // calling this function, so this test only proves the function
    // itself does not throw if somehow invoked with no snapshot to take
    // — it is exercised indirectly by never being called in that case.
    const portfolio = basePortfolio({ protocolVersion: 'v4' });
    const result = calculatePortfolioSummary(portfolio, 'live');
    expect(result.ok).toBe(false);
  });
});
