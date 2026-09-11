import { describe, expect, it } from 'vitest';

import { buildSafetyTargetsStatusSummary } from '@/features/dashboard';
import {
  formatCurrency,
  formatHealthFactor,
  formatPercentagePoints,
} from '@/features/dashboard/utils/format';
import { buildPortfolioPositionsCsv } from '@/services/export/CsvExporter';
import {
  buildSafetyTargetsStatus,
  formatSafetyTargetStatusLabel,
} from '@/services/portfolio/safetyTargetsStatus';
import { calculatePortfolioSummary } from '@/services/portfolio/summary';
import type { Portfolio } from '@/types/portfolio';

/**
 * Safety Targets Cross-Surface Consistency Proof — v1.23.0 Batch 3
 * ("Safety Targets Cross-Surface Consistency Proof", the final planned
 * v1.23.0 implementation batch). Proves that `portfolio.settings.safetyTargets`
 * flows to the same values across all three surfaces that present it:
 *
 * 1. The canonical Batch 1 service (`buildSafetyTargetsStatus`,
 *    `services/portfolio/safetyTargetsStatus.ts`) — also the Portfolio
 *    page's own presentation path: `app/portfolio/SafetyTargetsStatusPanel.tsx`
 *    calls this exact function and performs formatting only (no
 *    comparison, no recalculation of its own — its own header comment),
 *    so asserting against the canonical function's own output *is*
 *    asserting the Portfolio-page-presented values.
 * 2. The Batch 2 Dashboard summary (`buildSafetyTargetsStatusSummary`,
 *    `features/dashboard/utils/buildSafetyTargetsStatusSummary.ts`) —
 *    itself a thin formatter around one call to `buildSafetyTargetsStatus`
 *    (its own header comment: "Derives no comparison of its own").
 * 3. The existing CSV export (`buildPortfolioPositionsCsv`,
 *    `services/export/CsvExporter.ts`), columns "Target Health Factor" /
 *    "Holding Period (Days)" / "Target BTC Price (USD)" / "Safety Buffer
 *    (%)" (v1.22.0 Batch 1), plus "BTC Price (USD)" (pre-existing).
 *
 * **This file does not duplicate `csvJsonCrossExportConsistency.test.ts`.**
 * That file (v1.21.0 Batch 3 / v1.22.0 Batch 2) proves CSV and JSON agree
 * on the *raw persisted* `Portfolio` fields — it never touches
 * `buildSafetyTargetsStatus`, the Portfolio panel, or the Dashboard
 * summary. This file proves the newer relationship those three
 * *presentation* surfaces have with each other and with CSV — a genuinely
 * different claim, reusing that file's own `basePortfolio`/scenario-
 * lettering conventions where coherent, not its assertions.
 *
 * **Target-value agreement is provable for all four fields**: CSV's four
 * Safety Targets columns and `buildSafetyTargetsStatus`'s own `.target`
 * field both read `portfolio.settings.safetyTargets.<field>` verbatim,
 * with the identical `?? null` convention — confirmed by direct source
 * inspection of both `services/portfolio/safetyTargetsStatus.ts` and
 * `services/export/CsvExporter.ts` before writing this file. **Current-
 * value agreement is only provable for `targetBtcPriceUsd`** — CSV has no
 * "current" column at all for the other three fields (`targetHealthFactor`,
 * `safetyBufferPercent`, `holdingPeriodDays`); CsvExporter.ts's own header
 * comment is explicit that the export is deliberately raw-fields-only
 * ("No comparison is computed here... those are derived, read-time-only
 * figures owned exclusively by" the comparison service). CSV's "BTC Price
 * (USD)" column is the one coincidental exception — it already exists for
 * an unrelated reason (the portfolio's live market price) and happens to
 * read the exact same `portfolio.market.btcPriceUsd` field
 * `buildSafetyTargetsStatus` uses as `targetBtcPriceUsd.current`. This is
 * not a gap this batch needs to close — CSV was never designed to export
 * computed current-vs-target comparisons for the other three fields, and
 * inventing one here would be exactly the kind of second calculation path
 * this batch's own instructions prohibit.
 *
 * No discrepancy was found between any two surfaces while building this
 * file — every scenario below is confirmatory, not a repair.
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

// Holding Period's "current" value is real elapsed-day arithmetic against
// wall-clock time (`buildSafetyTargetsStatus`'s own `now: Date = new
// Date()` default) — `buildSafetyTargetsStatusSummary` (Dashboard) has no
// way to inject an override, so every call below intentionally uses the
// real clock rather than a fixed date, keeping the canonical/Dashboard
// calls in each test trivially in agreement (both resolve `new Date()`
// microseconds apart, well within the same calendar day).
const CSV_INDEX = {
  btcPriceUsd: 6,
  targetHealthFactor: 34,
  holdingPeriodDays: 35,
  targetBtcPriceUsd: 36,
  safetyBufferPercent: 37,
} as const;

function csvRowFor(csvLines: string[], portfolioId: string): string[] {
  const row = csvLines.slice(1).find((line) => line.startsWith(`${portfolioId},`));
  if (row === undefined) throw new Error(`no CSV row found for portfolio "${portfolioId}"`);
  return row.split(',');
}

function dashboardRowFor(summary: ReturnType<typeof buildSafetyTargetsStatusSummary>, key: string) {
  const row = summary.rows.find((r) => r.key === key);
  if (row === undefined) throw new Error(`no Dashboard row found for key "${key}"`);
  return row;
}

/** Confirms the five CSV column indices this file depends on, directly against the real header row — the same "not assumed" discipline `csvJsonCrossExportConsistency.test.ts` already established. */
describe('safety targets cross-surface consistency — CSV column indices', () => {
  it('confirms the five CSV column indices this file depends on', () => {
    const csv = buildPortfolioPositionsCsv([basePortfolio()]);
    const header = csv.split('\n')[0]!.split(',');
    expect(header[CSV_INDEX.btcPriceUsd]).toBe('BTC Price (USD)');
    expect(header[CSV_INDEX.targetHealthFactor]).toBe('Target Health Factor');
    expect(header[CSV_INDEX.holdingPeriodDays]).toBe('Holding Period (Days)');
    expect(header[CSV_INDEX.targetBtcPriceUsd]).toBe('Target BTC Price (USD)');
    expect(header[CSV_INDEX.safetyBufferPercent]).toBe('Safety Buffer (%)');
  });
});

describe('safety targets cross-surface consistency — A. all four targets fully configured', () => {
  it('canonical service, Dashboard summary, and CSV export all agree on target values; current BTC price agrees where CSV has a comparable column', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: {
          targetHealthFactor: 1.8,
          holdingPeriodDays: 90,
          targetBtcPriceUsd: 45000, // below current 50000 -> "met"
          safetyBufferPercent: 15,
        },
      },
    });
    const portfolioSummary = calculatePortfolioSummary(portfolio, 'manual');
    const canonical = buildSafetyTargetsStatus(portfolio, portfolioSummary);
    const dashboard = buildSafetyTargetsStatusSummary(portfolio, portfolioSummary);
    const csv = buildPortfolioPositionsCsv([portfolio]);
    const csvFields = csvRowFor(csv.split('\n'), portfolio.id);

    // Target values: canonical <-> CSV, for all four fields.
    expect(canonical.targetHealthFactor.target).toBe(1.8);
    expect(csvFields[CSV_INDEX.targetHealthFactor]).toBe('1.8');
    expect(canonical.holdingPeriodDays.target).toBe(90);
    expect(csvFields[CSV_INDEX.holdingPeriodDays]).toBe('90');
    expect(canonical.targetBtcPriceUsd.target).toBe(45000);
    expect(csvFields[CSV_INDEX.targetBtcPriceUsd]).toBe('45000');
    expect(canonical.safetyBufferPercent.target).toBe(15);
    expect(csvFields[CSV_INDEX.safetyBufferPercent]).toBe('15');

    // Current BTC price: canonical <-> CSV's own unrelated "BTC Price (USD)" column.
    expect(canonical.targetBtcPriceUsd.current).toBe(50000);
    expect(csvFields[CSV_INDEX.btcPriceUsd]).toBe('50000');

    // Dashboard: status is a direct copy of canonical's own status (never recalculated),
    // and the formatted detail text agrees with canonical's own target/current numbers,
    // constructed using the Dashboard's own real formatter functions (not reimplemented).
    const hfRow = dashboardRowFor(dashboard, 'targetHealthFactor');
    expect(hfRow.status).toBe(canonical.targetHealthFactor.status);
    expect(hfRow.detailFormatted).toBe(
      `Target: ${formatHealthFactor(canonical.targetHealthFactor.target!)} · Current: ${formatHealthFactor(canonical.targetHealthFactor.current!)}`,
    );

    const periodRow = dashboardRowFor(dashboard, 'holdingPeriodDays');
    expect(periodRow.status).toBe(canonical.holdingPeriodDays.status);
    expect(periodRow.detailFormatted).toBe(
      `Target: ${canonical.holdingPeriodDays.target} days · Current: ${canonical.holdingPeriodDays.current} days elapsed`,
    );

    const priceRow = dashboardRowFor(dashboard, 'targetBtcPriceUsd');
    expect(priceRow.status).toBe(canonical.targetBtcPriceUsd.status);
    expect(priceRow.detailFormatted).toBe(
      `Target: ${formatCurrency(canonical.targetBtcPriceUsd.target!)} · Current: ${formatCurrency(canonical.targetBtcPriceUsd.current!)}`,
    );

    const bufferRow = dashboardRowFor(dashboard, 'safetyBufferPercent');
    expect(bufferRow.status).toBe(canonical.safetyBufferPercent.status);
    expect(bufferRow.detailFormatted).toBe(
      `Target: ${formatPercentagePoints(canonical.safetyBufferPercent.target!)} · Current: ${formatPercentagePoints(canonical.safetyBufferPercent.current!)}`,
    );
  });
});

describe('safety targets cross-surface consistency — B. all four targets absent', () => {
  it('canonical, Dashboard, and CSV all agree the targets are unconfigured; current BTC price still agrees', () => {
    const portfolio = basePortfolio({ settings: {} });
    const portfolioSummary = calculatePortfolioSummary(portfolio, 'manual');
    const canonical = buildSafetyTargetsStatus(portfolio, portfolioSummary);
    const dashboard = buildSafetyTargetsStatusSummary(portfolio, portfolioSummary);
    const csv = buildPortfolioPositionsCsv([portfolio]);
    const csvFields = csvRowFor(csv.split('\n'), portfolio.id);

    for (const field of [
      'targetHealthFactor',
      'holdingPeriodDays',
      'targetBtcPriceUsd',
      'safetyBufferPercent',
    ] as const) {
      expect(canonical[field].status).toBe('not_configured');
      expect(canonical[field].target).toBeNull();
      expect(csvFields[CSV_INDEX[field]]).toBe('Not available');
      const row = dashboardRowFor(dashboard, field);
      expect(row.status).toBe('not_configured');
      expect(row.statusLabel).toBe('Not configured');
      expect(row.detailFormatted).toContain('Target: —');
    }

    expect(canonical.targetBtcPriceUsd.current).toBe(50000);
    expect(csvFields[CSV_INDEX.btcPriceUsd]).toBe('50000');
  });
});

describe('safety targets cross-surface consistency — C. partially configured targets', () => {
  it("each field is independently consistent across all three surfaces — no field borrows another's configuration", () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: { targetHealthFactor: 2, targetBtcPriceUsd: 60000 }, // holdingPeriodDays/safetyBufferPercent deliberately absent
      },
    });
    const portfolioSummary = calculatePortfolioSummary(portfolio, 'manual');
    const canonical = buildSafetyTargetsStatus(portfolio, portfolioSummary);
    const dashboard = buildSafetyTargetsStatusSummary(portfolio, portfolioSummary);
    const csv = buildPortfolioPositionsCsv([portfolio]);
    const csvFields = csvRowFor(csv.split('\n'), portfolio.id);

    expect(canonical.targetHealthFactor.target).toBe(2);
    expect(csvFields[CSV_INDEX.targetHealthFactor]).toBe('2');
    expect(dashboardRowFor(dashboard, 'targetHealthFactor').status).toBe(
      canonical.targetHealthFactor.status,
    );

    expect(canonical.targetBtcPriceUsd.target).toBe(60000);
    expect(csvFields[CSV_INDEX.targetBtcPriceUsd]).toBe('60000');
    expect(dashboardRowFor(dashboard, 'targetBtcPriceUsd').status).toBe(
      canonical.targetBtcPriceUsd.status,
    );

    expect(canonical.holdingPeriodDays.status).toBe('not_configured');
    expect(csvFields[CSV_INDEX.holdingPeriodDays]).toBe('Not available');
    expect(dashboardRowFor(dashboard, 'holdingPeriodDays').status).toBe('not_configured');

    expect(canonical.safetyBufferPercent.status).toBe('not_configured');
    expect(csvFields[CSV_INDEX.safetyBufferPercent]).toBe('Not available');
    expect(dashboardRowFor(dashboard, 'safetyBufferPercent').status).toBe('not_configured');
  });
});

describe('safety targets cross-surface consistency — D. valid zero values', () => {
  it('holdingPeriodDays=0 and safetyBufferPercent=0 are preserved as real zeros, never absence, across all three surfaces', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { holdingPeriodDays: 0, safetyBufferPercent: 0 } },
    });
    const portfolioSummary = calculatePortfolioSummary(portfolio, 'manual');
    const canonical = buildSafetyTargetsStatus(portfolio, portfolioSummary);
    const dashboard = buildSafetyTargetsStatusSummary(portfolio, portfolioSummary);
    const csv = buildPortfolioPositionsCsv([portfolio]);
    const csvFields = csvRowFor(csv.split('\n'), portfolio.id);

    expect(canonical.holdingPeriodDays.target).toBe(0);
    expect(canonical.holdingPeriodDays.status).not.toBe('not_configured');
    expect(csvFields[CSV_INDEX.holdingPeriodDays]).toBe('0');
    expect(csvFields[CSV_INDEX.holdingPeriodDays]).not.toBe('Not available');
    const periodRow = dashboardRowFor(dashboard, 'holdingPeriodDays');
    expect(periodRow.status).not.toBe('not_configured');
    expect(periodRow.detailFormatted).toContain('Target: 0 days');

    expect(canonical.safetyBufferPercent.target).toBe(0);
    expect(canonical.safetyBufferPercent.status).not.toBe('not_configured');
    expect(csvFields[CSV_INDEX.safetyBufferPercent]).toBe('0');
    expect(csvFields[CSV_INDEX.safetyBufferPercent]).not.toBe('Not available');
    const bufferRow = dashboardRowFor(dashboard, 'safetyBufferPercent');
    expect(bufferRow.status).not.toBe('not_configured');
    expect(bufferRow.detailFormatted).toContain(`Target: ${formatPercentagePoints(0)}`);
  });
});

describe('safety targets cross-surface consistency — E. multiple portfolios, no cross-record leakage', () => {
  it('two portfolios with differing safety-target configurations keep their own values distinct across canonical/Dashboard/CSV', () => {
    const portfolioA = basePortfolio({
      id: 'portfolio-a',
      market: { btcPriceUsd: 40000 },
      settings: { safetyTargets: { targetHealthFactor: 2.5, holdingPeriodDays: 45 } },
    });
    const portfolioB = basePortfolio({
      id: 'portfolio-b',
      market: { btcPriceUsd: 70000 },
      settings: { safetyTargets: { targetBtcPriceUsd: 100000, safetyBufferPercent: 20 } },
    });
    const summaryA = calculatePortfolioSummary(portfolioA, 'manual');
    const summaryB = calculatePortfolioSummary(portfolioB, 'manual');
    const canonicalA = buildSafetyTargetsStatus(portfolioA, summaryA);
    const canonicalB = buildSafetyTargetsStatus(portfolioB, summaryB);
    const dashboardA = buildSafetyTargetsStatusSummary(portfolioA, summaryA);
    const dashboardB = buildSafetyTargetsStatusSummary(portfolioB, summaryB);
    const csv = buildPortfolioPositionsCsv([portfolioA, portfolioB]);
    const csvLines = csv.split('\n');
    expect(csvLines).toHaveLength(3); // header + 2 rows
    const csvA = csvRowFor(csvLines, 'portfolio-a');
    const csvB = csvRowFor(csvLines, 'portfolio-b');

    // Portfolio A: targetHealthFactor/holdingPeriodDays configured; must not pick up B's values.
    expect(canonicalA.targetHealthFactor.target).toBe(2.5);
    expect(csvA[CSV_INDEX.targetHealthFactor]).toBe('2.5');
    expect(canonicalA.holdingPeriodDays.target).toBe(45);
    expect(csvA[CSV_INDEX.holdingPeriodDays]).toBe('45');
    expect(csvA[CSV_INDEX.targetBtcPriceUsd]).toBe('Not available');
    expect(csvA[CSV_INDEX.safetyBufferPercent]).toBe('Not available');
    expect(csvA[CSV_INDEX.btcPriceUsd]).toBe('40000');
    expect(dashboardRowFor(dashboardA, 'targetHealthFactor').status).toBe(
      canonicalA.targetHealthFactor.status,
    );

    // Portfolio B: targetBtcPriceUsd/safetyBufferPercent configured; must not pick up A's values.
    expect(canonicalB.targetBtcPriceUsd.target).toBe(100000);
    expect(csvB[CSV_INDEX.targetBtcPriceUsd]).toBe('100000');
    expect(canonicalB.safetyBufferPercent.target).toBe(20);
    expect(csvB[CSV_INDEX.safetyBufferPercent]).toBe('20');
    expect(csvB[CSV_INDEX.targetHealthFactor]).toBe('Not available');
    expect(csvB[CSV_INDEX.holdingPeriodDays]).toBe('Not available');
    expect(csvB[CSV_INDEX.btcPriceUsd]).toBe('70000');
    expect(dashboardRowFor(dashboardB, 'targetBtcPriceUsd').status).toBe(
      canonicalB.targetBtcPriceUsd.status,
    );
  });
});

describe('safety targets cross-surface consistency — F. target values are stable regardless of current-value computability', () => {
  it('a zero-debt portfolio (Infinity health factor, no liquidation buffer) still exports/presents the exact same configured targets as CSV', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: {
        safetyTargets: {
          targetHealthFactor: 100,
          holdingPeriodDays: 30,
          targetBtcPriceUsd: 60000,
          safetyBufferPercent: 50,
        },
      },
    });
    const portfolioSummary = calculatePortfolioSummary(portfolio, 'manual');
    const canonical = buildSafetyTargetsStatus(portfolio, portfolioSummary);
    const csv = buildPortfolioPositionsCsv([portfolio]);
    const csvFields = csvRowFor(csv.split('\n'), portfolio.id);

    // Target Health Factor is "met" (Infinity clears any finite target);
    // Safety Buffer % is "unavailable" (no liquidation risk to compare against) —
    // neither affects the exported/presented *target* value itself.
    expect(canonical.targetHealthFactor.current).toBe(Infinity);
    expect(canonical.safetyBufferPercent.current).toBeNull();
    expect(canonical.targetHealthFactor.target).toBe(100);
    expect(csvFields[CSV_INDEX.targetHealthFactor]).toBe('100');
    expect(canonical.safetyBufferPercent.target).toBe(50);
    expect(csvFields[CSV_INDEX.safetyBufferPercent]).toBe('50');
    expect(canonical.holdingPeriodDays.target).toBe(30);
    expect(csvFields[CSV_INDEX.holdingPeriodDays]).toBe('30');
    expect(canonical.targetBtcPriceUsd.target).toBe(60000);
    expect(csvFields[CSV_INDEX.targetBtcPriceUsd]).toBe('60000');
  });

  it('a failed PortfolioSummary (invalid collateral) still exports/presents the exact same configured targets as CSV', () => {
    const portfolio = basePortfolio({
      collateral: { asset: 'BTC', quantity: -1 }, // forces calculatePortfolioSummary to fail
      settings: {
        safetyTargets: {
          targetHealthFactor: 2,
          holdingPeriodDays: 30,
          targetBtcPriceUsd: 40000,
          safetyBufferPercent: 50,
        },
      },
    });
    const portfolioSummary = calculatePortfolioSummary(portfolio, 'manual');
    expect(portfolioSummary.ok).toBe(false);
    const canonical = buildSafetyTargetsStatus(portfolio, portfolioSummary);
    const csv = buildPortfolioPositionsCsv([portfolio]);
    const csvFields = csvRowFor(csv.split('\n'), portfolio.id);

    expect(canonical.targetHealthFactor.status).toBe('unavailable');
    expect(canonical.safetyBufferPercent.status).toBe('unavailable');
    expect(canonical.targetHealthFactor.target).toBe(2);
    expect(csvFields[CSV_INDEX.targetHealthFactor]).toBe('2');
    expect(canonical.safetyBufferPercent.target).toBe(50);
    expect(csvFields[CSV_INDEX.safetyBufferPercent]).toBe('50');
    // Target BTC Price and Holding Period are unaffected by the failed summary either way.
    expect(canonical.targetBtcPriceUsd.target).toBe(40000);
    expect(csvFields[CSV_INDEX.targetBtcPriceUsd]).toBe('40000');
    expect(canonical.holdingPeriodDays.target).toBe(30);
    expect(csvFields[CSV_INDEX.holdingPeriodDays]).toBe('30');
  });
});

/**
 * Status-label text agreement (Safety Targets Semantic/Status Cleanup
 * batch) — the Portfolio panel and the Dashboard summary both call the
 * same `formatSafetyTargetStatusLabel` (`services/portfolio/safetyTargetsStatus.ts`),
 * so this proves the same target/state always produces the identical
 * status text on both surfaces, not merely the same `status` enum value.
 */
describe('Safety Targets Cross-Surface Consistency — status-label text agreement', () => {
  it('every target/state combination produces identical statusLabel text via the canonical helper and the Dashboard summary', () => {
    const scenarios: Partial<Portfolio>[] = [
      {
        settings: {
          safetyTargets: {
            targetHealthFactor: 2,
            targetBtcPriceUsd: 40000,
            safetyBufferPercent: 50,
            holdingPeriodDays: 0,
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
      { settings: {} },
    ];

    for (const overrides of scenarios) {
      const portfolio = basePortfolio(overrides);
      const portfolioSummary = calculatePortfolioSummary(portfolio, 'manual');
      const canonical = buildSafetyTargetsStatus(portfolio, portfolioSummary);
      const dashboard = buildSafetyTargetsStatusSummary(portfolio, portfolioSummary);

      for (const key of [
        'targetHealthFactor',
        'targetBtcPriceUsd',
        'safetyBufferPercent',
        'holdingPeriodDays',
      ] as const) {
        const unavailableText =
          key === 'safetyBufferPercent'
            ? portfolioSummary.ok
              ? 'No liquidation risk to compare against'
              : 'Not available'
            : 'Not available';
        const expectedLabel = formatSafetyTargetStatusLabel(key, canonical[key], unavailableText);
        expect(dashboardRowFor(dashboard, key).statusLabel).toBe(expectedLabel);
      }
    }
  });
});
