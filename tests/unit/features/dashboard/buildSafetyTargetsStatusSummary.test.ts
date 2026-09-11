import { describe, expect, it } from 'vitest';

import { buildSafetyTargetsStatusSummary } from '@/features/dashboard';
import { buildSafetyTargetsStatus } from '@/services/portfolio/safetyTargetsStatus';
import { calculatePortfolioSummary } from '@/services/portfolio/summary';
import type { Portfolio } from '@/types/portfolio';

/**
 * Safety Targets Status Summary builder — v1.23.0 Batch 2 (Dashboard
 * Safety Targets Status Integration).
 *
 * Fixture portfolio matches
 * `tests/unit/services/portfolio/safetyTargetsStatus.test.ts`'s own
 * exactly (2 BTC @ $50,000, $20,000 debt, 75%/80% LTV/liquidation-
 * threshold — `healthFactor: 4`, `liquidation: { price: 12500,
 * buffer: 75, ... }`), so this file's expectations are directly
 * cross-checkable against that already-verified suite.
 */
function basePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'My Portfolio',
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
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function rowFor(summary: ReturnType<typeof buildSafetyTargetsStatusSummary>, key: string) {
  const row = summary.rows.find((r) => r.key === key);
  if (row === undefined) throw new Error(`No row for key "${key}"`);
  return row;
}

describe('buildSafetyTargetsStatusSummary — canonical semantics evidence (no divergent recalculation)', () => {
  it("every row's status field is a byte-for-byte copy of buildSafetyTargetsStatus's own status, for every configuration shape", () => {
    const scenarios: Partial<Portfolio>[] = [
      { settings: {} },
      {
        settings: {
          safetyTargets: {
            targetHealthFactor: 2,
            targetBtcPriceUsd: 40000,
            safetyBufferPercent: 50,
            holdingPeriodDays: 30,
          },
        },
      },
      {
        settings: {
          safetyTargets: {
            targetHealthFactor: 10,
            targetBtcPriceUsd: 90000,
            safetyBufferPercent: 99,
            holdingPeriodDays: 9999,
          },
        },
      },
      { settings: { safetyTargets: { holdingPeriodDays: 0, safetyBufferPercent: 0 } } },
      {
        debt: { asset: 'USDC', balance: 0 },
        settings: { safetyTargets: { targetHealthFactor: 5, safetyBufferPercent: 10 } },
      },
      {
        collateral: { asset: 'BTC', quantity: -1 }, // forces calculatePortfolioSummary to fail
        settings: { safetyTargets: { targetHealthFactor: 2, safetyBufferPercent: 10 } },
      },
    ];

    for (const overrides of scenarios) {
      const portfolio = basePortfolio(overrides);
      const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
      const canonical = buildSafetyTargetsStatus(portfolio, summaryResult);
      const dashboard = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

      expect(rowFor(dashboard, 'targetHealthFactor').status).toBe(
        canonical.targetHealthFactor.status,
      );
      expect(rowFor(dashboard, 'targetBtcPriceUsd').status).toBe(
        canonical.targetBtcPriceUsd.status,
      );
      expect(rowFor(dashboard, 'safetyBufferPercent').status).toBe(
        canonical.safetyBufferPercent.status,
      );
      expect(rowFor(dashboard, 'holdingPeriodDays').status).toBe(
        canonical.holdingPeriodDays.status,
      );
    }
  });
});

describe('buildSafetyTargetsStatusSummary — all four configured', () => {
  it('formats Target/Current and "Met" for every field when current values clear their targets', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: {
          targetHealthFactor: 2,
          targetBtcPriceUsd: 40000,
          safetyBufferPercent: 50,
          holdingPeriodDays: 30,
        },
      },
    });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    expect(summary.rows).toHaveLength(4);

    const hf = rowFor(summary, 'targetHealthFactor');
    expect(hf.status).toBe('met');
    expect(hf.statusLabel).toBe('Met');
    expect(hf.detailFormatted).toBe('Target: 2 · Current: 4');

    const price = rowFor(summary, 'targetBtcPriceUsd');
    expect(price.status).toBe('met');
    expect(price.detailFormatted).toContain('$40,000');
    expect(price.detailFormatted).toContain('$50,000');
  });

  it('formats "Not met" when a current value falls short of its target', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetHealthFactor: 10 } },
    });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    expect(rowFor(summary, 'targetHealthFactor').statusLabel).toBe('Not met');
  });
});

describe('buildSafetyTargetsStatusSummary — all absent', () => {
  it('reports "Not configured" for every field', () => {
    const portfolio = basePortfolio({ settings: {} });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    for (const row of summary.rows) {
      expect(row.status).toBe('not_configured');
      expect(row.statusLabel).toBe('Not configured');
    }
  });
});

describe('buildSafetyTargetsStatusSummary — partial configuration', () => {
  it('treats each of the four fields independently', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetBtcPriceUsd: 30000 } },
    });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    expect(rowFor(summary, 'targetBtcPriceUsd').status).toBe('met');
    expect(rowFor(summary, 'targetHealthFactor').status).toBe('not_configured');
    expect(rowFor(summary, 'holdingPeriodDays').status).toBe('not_configured');
    expect(rowFor(summary, 'safetyBufferPercent').status).toBe('not_configured');
  });
});

describe('buildSafetyTargetsStatusSummary — valid zero targets', () => {
  it('holding period target of 0 is "Met", never "Not configured"', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { holdingPeriodDays: 0 } },
    });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    const row = rowFor(summary, 'holdingPeriodDays');
    expect(row.status).toBe('met');
    expect(row.detailFormatted).toContain('Target: 0 days');
  });

  it('safety buffer target of 0 is "Met", never "Not configured"', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 0 } },
    });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    const row = rowFor(summary, 'safetyBufferPercent');
    expect(row.status).toBe('met');
    expect(row.detailFormatted).toContain('Target: 0%');
  });
});

describe('buildSafetyTargetsStatusSummary — exact boundary behavior', () => {
  it('current exactly equal to target is "Met" (inclusive)', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetBtcPriceUsd: 50000 } }, // equals market.btcPriceUsd exactly
    });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    expect(rowFor(summary, 'targetBtcPriceUsd').status).toBe('met');
  });
});

describe('buildSafetyTargetsStatusSummary — zero-debt portfolio', () => {
  it('healthFactor Infinity always meets any finite target, formatted as "∞"', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { targetHealthFactor: 100 } },
    });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    const row = rowFor(summary, 'targetHealthFactor');
    expect(row.status).toBe('met');
    expect(row.detailFormatted).toContain('∞');
  });

  it('safety buffer is "unavailable" with an explicit "No liquidation risk" label, never a fabricated 0%', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { safetyBufferPercent: 50 } },
    });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    const row = rowFor(summary, 'safetyBufferPercent');
    expect(row.status).toBe('unavailable');
    expect(row.statusLabel).toBe('No liquidation risk to compare against');
    expect(row.detailFormatted).toBe('Target: 50% · Current: —');
  });
});

describe('buildSafetyTargetsStatusSummary — failed PortfolioSummary', () => {
  it('marks only the two summary-dependent fields "Not available"; Target BTC Price and Holding Period render normally', () => {
    const portfolio = basePortfolio({
      collateral: { asset: 'BTC', quantity: -1 }, // forces calculatePortfolioSummary to fail
      settings: {
        safetyTargets: {
          targetHealthFactor: 2,
          targetBtcPriceUsd: 40000,
          safetyBufferPercent: 50,
          holdingPeriodDays: 30,
        },
      },
    });
    const summaryResult = calculatePortfolioSummary(portfolio, 'manual');
    expect(summaryResult.ok).toBe(false);
    const summary = buildSafetyTargetsStatusSummary(portfolio, summaryResult);

    expect(rowFor(summary, 'targetHealthFactor').statusLabel).toBe('Not available');
    expect(rowFor(summary, 'safetyBufferPercent').statusLabel).toBe('Not available');
    expect(rowFor(summary, 'targetBtcPriceUsd').status).toBe('met');
    expect(rowFor(summary, 'holdingPeriodDays').status).toBe('met');
  });
});

/**
 * Target-specific status language (Safety Targets Semantic/Status
 * Cleanup batch) — the exact `statusLabel` text per target family,
 * proving the generic "Met"/"Not met" text never leaks onto Target BTC
 * Price, Holding Period, or Safety Buffer, and that Target Health
 * Factor's own "Met"/"Not met" is unchanged.
 */
describe('buildSafetyTargetsStatusSummary — target-specific status labels', () => {
  it('Target Health Factor: "Met"/"Not met"', () => {
    const met = buildSafetyTargetsStatusSummary(
      basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 2 } } }),
      calculatePortfolioSummary(
        basePortfolio({ settings: { safetyTargets: { targetHealthFactor: 2 } } }),
        'manual',
      ),
    );
    expect(rowFor(met, 'targetHealthFactor').statusLabel).toBe('Met');

    const notMetPortfolio = basePortfolio({
      settings: { safetyTargets: { targetHealthFactor: 10 } },
    });
    const notMet = buildSafetyTargetsStatusSummary(
      notMetPortfolio,
      calculatePortfolioSummary(notMetPortfolio, 'manual'),
    );
    expect(rowFor(notMet, 'targetHealthFactor').statusLabel).toBe('Not met');
  });

  it('Target BTC Price: "Target reached"/"Below target", never "Met"/"Not met"', () => {
    const reachedPortfolio = basePortfolio({
      settings: { safetyTargets: { targetBtcPriceUsd: 40000 } }, // below market.btcPriceUsd (50000)
    });
    const reached = buildSafetyTargetsStatusSummary(
      reachedPortfolio,
      calculatePortfolioSummary(reachedPortfolio, 'manual'),
    );
    expect(rowFor(reached, 'targetBtcPriceUsd').statusLabel).toBe('Target reached');

    const belowPortfolio = basePortfolio({
      settings: { safetyTargets: { targetBtcPriceUsd: 60000 } }, // above market.btcPriceUsd (50000)
    });
    const below = buildSafetyTargetsStatusSummary(
      belowPortfolio,
      calculatePortfolioSummary(belowPortfolio, 'manual'),
    );
    expect(rowFor(below, 'targetBtcPriceUsd').statusLabel).toBe('Below target');
  });

  it('Holding Period: "Target reached"/"In progress", never "Met"/"Not met"', () => {
    const reachedPortfolio = basePortfolio({
      settings: { safetyTargets: { holdingPeriodDays: 0 } },
    });
    const reached = buildSafetyTargetsStatusSummary(
      reachedPortfolio,
      calculatePortfolioSummary(reachedPortfolio, 'manual'),
    );
    expect(rowFor(reached, 'holdingPeriodDays').statusLabel).toBe('Target reached');

    const inProgressPortfolio = basePortfolio({
      createdAt: new Date().toISOString(),
      settings: { safetyTargets: { holdingPeriodDays: 9999 } },
    });
    const inProgress = buildSafetyTargetsStatusSummary(
      inProgressPortfolio,
      calculatePortfolioSummary(inProgressPortfolio, 'manual'),
    );
    expect(rowFor(inProgress, 'holdingPeriodDays').statusLabel).toBe('In progress');
  });

  it('Safety Buffer: "On target"/"Below target", never "Met"/"Not met"', () => {
    const onTargetPortfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 50 } }, // below the real ~75% buffer here
    });
    const onTarget = buildSafetyTargetsStatusSummary(
      onTargetPortfolio,
      calculatePortfolioSummary(onTargetPortfolio, 'manual'),
    );
    expect(rowFor(onTarget, 'safetyBufferPercent').statusLabel).toBe('On target');

    const belowPortfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 99 } }, // above the real ~75% buffer here
    });
    const below = buildSafetyTargetsStatusSummary(
      belowPortfolio,
      calculatePortfolioSummary(belowPortfolio, 'manual'),
    );
    expect(rowFor(below, 'safetyBufferPercent').statusLabel).toBe('Below target');
  });
});
