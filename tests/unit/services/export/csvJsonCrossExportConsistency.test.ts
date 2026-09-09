import { describe, expect, it } from 'vitest';

import { buildPortfolioPositionsCsv } from '@/services/export/CsvExporter';
import { buildFullBackupFile, serializeExportFile } from '@/services/export/JsonExporter';
import { createMemoryAdapter } from '@/services/persistence/adapters';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import type { Portfolio } from '@/types/portfolio';

/**
 * CSV/JSON cross-export consistency proof — v1.21.0 Batch 3 ("Portfolio
 * CSV Export Field Completeness"). Proves the seven fields Batches 1–2
 * newly exposed in `buildPortfolioPositionsCsv` (Starting-Value Baseline:
 * `establishedAt`/`collateralQuantity`/`marketPriceUsd`; Recommendation
 * Preferences: `borrow.userMinHealthFactor`/`.targetDebtRatio`,
 * `loop.loopBorrowPercentage`/`.maxAcceptableAnnualInterestCost`)
 * represent the same underlying persisted `Portfolio` values the existing
 * JSON exporter (`services/export/JsonExporter.ts`) already round-trips —
 * test-only, per this batch's own scope, and it modifies neither
 * exporter's production behavior.
 *
 * **The two exporters are structurally different, and this file does not
 * try to make them look alike.** `buildPortfolioPositionsCsv` takes a
 * `Portfolio[]` directly and returns one fixed-column row per portfolio.
 * `buildFullBackupFile` instead reads through the real persistence layer
 * (`PersistenceService.listEnvelopes`) and returns an envelope whose
 * `payload` is the same `Portfolio` object, verbatim — proven already by
 * `JsonExporter.test.ts`'s own "preserves the real envelope timestamps"
 * test. The invariant this file proves is **same canonical `Portfolio`
 * input → same raw value → representation-specific serialization only**:
 * CSV textualizes every field (including its own `null` →
 * `'Not available'` convention for an absent value); JSON's existing
 * contract is untouched — an absent optional field is simply not present
 * on the serialized `payload` object (standard `JSON.stringify` behavior
 * for an `undefined`-valued property), never coerced to any placeholder
 * string. Both exporters are called through their real, existing, public
 * functions — `buildPortfolioPositionsCsv` directly, and the full
 * `write` → `buildFullBackupFile` → `serializeExportFile` → `JSON.parse`
 * chain for JSON — nothing here reimplements either exporter's own logic.
 */

const now = () => '2026-03-15T12:00:00.000Z';

function basePortfolio(id = 'portfolio-1'): Portfolio {
  return {
    id,
    // Comma-free — this file's own by-index CSV row lookup (`csvRowFor`)
    // and this directory's established `CsvExporter.test.ts` convention
    // both rely on it.
    name: 'Cross-Export Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/**
 * The seven columns' indices in `buildPortfolioPositionsCsv`'s own header
 * row (v1.21.0 Batches 1–2) — not assumed here; the final test in this
 * file verifies every one of these seven names against the real header
 * row directly, so a future column reorder fails loudly instead of
 * silently misaligning every other test in this file.
 */
const CSV_INDEX = {
  establishedAt: 27,
  collateralQuantity: 28,
  marketPriceUsd: 29,
  userMinHealthFactor: 30,
  targetDebtRatio: 31,
  loopBorrowPercentage: 32,
  maxAcceptableAnnualInterestCost: 33,
  // v1.22.0 Batch 1 ("Portfolio CSV Export Completeness, Part 2") —
  // Safety Targets columns, appended after the seven v1.21.0 columns
  // above. Same "not assumed" discipline: the header-index confirmation
  // test at the bottom of the v1.22.0 Batch 2 describe block below
  // verifies every one of these four names against the real header row
  // directly.
  targetHealthFactor: 34,
  holdingPeriodDays: 35,
  targetBtcPriceUsd: 36,
  safetyBufferPercent: 37,
} as const;

interface JsonPortfolioEnvelope {
  recordId: string;
  payload: Portfolio;
}

async function exportBothRepresentations(
  portfolios: Portfolio[],
): Promise<{ csvLines: string[]; jsonPortfolios: JsonPortfolioEnvelope[] }> {
  const csv = buildPortfolioPositionsCsv(portfolios);

  const service = createPersistenceService(createMemoryAdapter());
  for (const portfolio of portfolios) {
    const written = await service.write('portfolio', portfolio.id, portfolio);
    if (!written.ok) throw new Error(`setup failed writing ${portfolio.id}`);
  }
  const backupResult = await buildFullBackupFile({ service, now });
  if (!backupResult.ok) throw new Error('setup failed building the full backup file');

  // Go through the real serialize → parse round trip, the same path a
  // consumer of the actual downloaded JSON file would take — not just
  // reading `backupResult.data` directly in memory.
  const serialized = serializeExportFile(backupResult.data);
  const parsed = JSON.parse(serialized) as {
    records: { portfolio?: JsonPortfolioEnvelope[] };
  };

  return { csvLines: csv.split('\n'), jsonPortfolios: parsed.records.portfolio ?? [] };
}

function csvRowFor(csvLines: string[], portfolioId: string): string[] {
  const row = csvLines.slice(1).find((line) => line.startsWith(`${portfolioId},`));
  if (row === undefined) throw new Error(`no CSV row found for portfolio "${portfolioId}"`);
  return row.split(',');
}

function jsonPayloadFor(envelopes: JsonPortfolioEnvelope[], portfolioId: string): Portfolio {
  const envelope = envelopes.find((candidate) => candidate.recordId === portfolioId);
  if (envelope === undefined)
    throw new Error(`no JSON record found for portfolio "${portfolioId}"`);
  return envelope.payload;
}

describe('CSV/JSON cross-export consistency — Starting-Value Baseline & Recommendation Preferences (v1.21.0 Batch 3)', () => {
  it('A. fully populated portfolio: all seven values correspond exactly across CSV and JSON', async () => {
    const portfolio: Portfolio = {
      ...basePortfolio(),
      establishedAt: '2026-06-01T00:00:00.000Z',
      collateralQuantity: 1.5,
      marketPriceUsd: 45000,
      settings: {
        recommendationPreferences: {
          borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 },
          loop: { loopBorrowPercentage: 0.6, maxAcceptableAnnualInterestCost: 2500 },
        },
      },
    };

    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolio]);
    const csvFields = csvRowFor(csvLines, portfolio.id);
    const jsonPayload = jsonPayloadFor(jsonPortfolios, portfolio.id);
    const preferences = jsonPayload.settings.recommendationPreferences!;

    expect(csvFields[CSV_INDEX.establishedAt]).toBe(portfolio.establishedAt);
    expect(jsonPayload.establishedAt).toBe(portfolio.establishedAt);

    expect(csvFields[CSV_INDEX.collateralQuantity]).toBe('1.5');
    expect(jsonPayload.collateralQuantity).toBe(1.5);

    expect(csvFields[CSV_INDEX.marketPriceUsd]).toBe('45000');
    expect(jsonPayload.marketPriceUsd).toBe(45000);

    expect(csvFields[CSV_INDEX.userMinHealthFactor]).toBe('1.5');
    expect(preferences.borrow?.userMinHealthFactor).toBe(1.5);

    expect(csvFields[CSV_INDEX.targetDebtRatio]).toBe('0.5');
    expect(preferences.borrow?.targetDebtRatio).toBe(0.5);

    expect(csvFields[CSV_INDEX.loopBorrowPercentage]).toBe('0.6');
    expect(preferences.loop?.loopBorrowPercentage).toBe(0.6);

    expect(csvFields[CSV_INDEX.maxAcceptableAnnualInterestCost]).toBe('2500');
    expect(preferences.loop?.maxAcceptableAnnualInterestCost).toBe(2500);
  });

  it('B. completely absent baseline/preferences: CSV reports "Not available", JSON omits the properties entirely (its own existing contract, unchanged)', async () => {
    const portfolio = basePortfolio();
    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolio]);
    const csvFields = csvRowFor(csvLines, portfolio.id);
    const jsonPayload = jsonPayloadFor(jsonPortfolios, portfolio.id);
    const rawPayload = jsonPayload as unknown as Record<string, unknown>;
    const rawSettings = jsonPayload.settings as unknown as Record<string, unknown>;

    expect(csvFields[CSV_INDEX.establishedAt]).toBe('Not available');
    expect('establishedAt' in rawPayload).toBe(false);

    expect(csvFields[CSV_INDEX.collateralQuantity]).toBe('Not available');
    expect('collateralQuantity' in rawPayload).toBe(false);

    expect(csvFields[CSV_INDEX.marketPriceUsd]).toBe('Not available');
    expect('marketPriceUsd' in rawPayload).toBe(false);

    expect(csvFields[CSV_INDEX.userMinHealthFactor]).toBe('Not available');
    expect(csvFields[CSV_INDEX.targetDebtRatio]).toBe('Not available');
    expect(csvFields[CSV_INDEX.loopBorrowPercentage]).toBe('Not available');
    expect(csvFields[CSV_INDEX.maxAcceptableAnnualInterestCost]).toBe('Not available');
    // JSON never invents an empty `recommendationPreferences` object to
    // stand in for "none configured" — the property itself is absent.
    expect('recommendationPreferences' in rawSettings).toBe(false);
  });

  it('C. partial nested preferences remain partial in both representations — no default/fallback appears in either', async () => {
    const portfolio: Portfolio = {
      ...basePortfolio(),
      settings: {
        recommendationPreferences: {
          borrow: { userMinHealthFactor: 1.4 }, // targetDebtRatio deliberately absent
          loop: { maxAcceptableAnnualInterestCost: 900 }, // loopBorrowPercentage deliberately absent
        },
      },
    };

    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolio]);
    const csvFields = csvRowFor(csvLines, portfolio.id);
    const jsonPayload = jsonPayloadFor(jsonPortfolios, portfolio.id);
    const preferences = jsonPayload.settings.recommendationPreferences!;
    const rawBorrow = preferences.borrow as unknown as Record<string, unknown>;
    const rawLoop = preferences.loop as unknown as Record<string, unknown>;

    expect(csvFields[CSV_INDEX.userMinHealthFactor]).toBe('1.4');
    expect(preferences.borrow?.userMinHealthFactor).toBe(1.4);
    expect(csvFields[CSV_INDEX.targetDebtRatio]).toBe('Not available');
    expect('targetDebtRatio' in rawBorrow).toBe(false);

    expect(csvFields[CSV_INDEX.maxAcceptableAnnualInterestCost]).toBe('900');
    expect(preferences.loop?.maxAcceptableAnnualInterestCost).toBe(900);
    expect(csvFields[CSV_INDEX.loopBorrowPercentage]).toBe('Not available');
    expect('loopBorrowPercentage' in rawLoop).toBe(false);
  });

  it('D. mixed multi-portfolio export: rows/records correspond to the correct portfolio, no cross-row leakage', async () => {
    const portfolioA: Portfolio = {
      ...basePortfolio('portfolio-a'),
      establishedAt: '2026-02-01T00:00:00.000Z',
      collateralQuantity: 3,
      marketPriceUsd: 40000,
      settings: {
        recommendationPreferences: { borrow: { userMinHealthFactor: 1.8, targetDebtRatio: 0.3 } },
      },
    };
    const portfolioB: Portfolio = {
      ...basePortfolio('portfolio-b'),
      establishedAt: '2026-05-01T00:00:00.000Z',
      collateralQuantity: 0.75,
      marketPriceUsd: 70000,
      settings: {
        recommendationPreferences: {
          loop: { loopBorrowPercentage: 0.4, maxAcceptableAnnualInterestCost: 1800 },
        },
      },
    };

    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolioA, portfolioB]);
    expect(csvLines).toHaveLength(3); // header + 2 rows
    expect(jsonPortfolios).toHaveLength(2);

    const csvA = csvRowFor(csvLines, 'portfolio-a');
    const jsonA = jsonPayloadFor(jsonPortfolios, 'portfolio-a');
    expect(csvA[CSV_INDEX.marketPriceUsd]).toBe('40000');
    expect(jsonA.marketPriceUsd).toBe(40000);
    expect(csvA[CSV_INDEX.userMinHealthFactor]).toBe('1.8');
    expect(jsonA.settings.recommendationPreferences?.borrow?.userMinHealthFactor).toBe(1.8);
    // Portfolio A has no Loop preferences configured — must not pick up
    // Portfolio B's own Loop values in either representation.
    expect(csvA[CSV_INDEX.loopBorrowPercentage]).toBe('Not available');
    expect(jsonA.settings.recommendationPreferences?.loop).toBeUndefined();

    const csvB = csvRowFor(csvLines, 'portfolio-b');
    const jsonB = jsonPayloadFor(jsonPortfolios, 'portfolio-b');
    expect(csvB[CSV_INDEX.marketPriceUsd]).toBe('70000');
    expect(jsonB.marketPriceUsd).toBe(70000);
    expect(csvB[CSV_INDEX.loopBorrowPercentage]).toBe('0.4');
    expect(jsonB.settings.recommendationPreferences?.loop?.loopBorrowPercentage).toBe(0.4);
    // Portfolio B has no Borrow preferences configured — must not pick up
    // Portfolio A's own Borrow values in either representation.
    expect(csvB[CSV_INDEX.userMinHealthFactor]).toBe('Not available');
    expect(jsonB.settings.recommendationPreferences?.borrow).toBeUndefined();
  });

  it('E. a valid zero (Baseline Collateral Quantity, Target Debt Ratio, Loop Borrow Percentage) is preserved, never mistaken for a missing value', async () => {
    // `collateralQuantity: 0` is `docs/STARTING_VALUE_BASELINE_SPEC.md`
    // §4/§16 criterion 7's own documented zero-baseline-value edge case.
    // `targetDebtRatio`/`loopBorrowPercentage` both validate `[0, 1]`
    // inclusive (`types/portfolio.schema.ts`'s own
    // `recommendationPreferencesSchema`) — 0 is a genuinely valid
    // configured value for both, unlike `userMinHealthFactor`/
    // `maxAcceptableAnnualInterestCost`, which validate strictly positive
    // and so have no valid zero case to test here.
    const portfolio: Portfolio = {
      ...basePortfolio(),
      establishedAt: '2026-07-01T00:00:00.000Z',
      collateralQuantity: 0,
      marketPriceUsd: 60000,
      settings: {
        recommendationPreferences: {
          borrow: { targetDebtRatio: 0 },
          loop: { loopBorrowPercentage: 0 },
        },
      },
    };

    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolio]);
    const csvFields = csvRowFor(csvLines, portfolio.id);
    const jsonPayload = jsonPayloadFor(jsonPortfolios, portfolio.id);
    const preferences = jsonPayload.settings.recommendationPreferences!;

    expect(csvFields[CSV_INDEX.collateralQuantity]).toBe('0');
    expect(csvFields[CSV_INDEX.collateralQuantity]).not.toBe('Not available');
    expect(jsonPayload.collateralQuantity).toBe(0);

    expect(csvFields[CSV_INDEX.targetDebtRatio]).toBe('0');
    expect(csvFields[CSV_INDEX.targetDebtRatio]).not.toBe('Not available');
    expect(preferences.borrow?.targetDebtRatio).toBe(0);

    expect(csvFields[CSV_INDEX.loopBorrowPercentage]).toBe('0');
    expect(csvFields[CSV_INDEX.loopBorrowPercentage]).not.toBe('Not available');
    expect(preferences.loop?.loopBorrowPercentage).toBe(0);
  });

  it('confirms the seven CSV column indices this test file depends on, directly against the real header row', () => {
    const csv = buildPortfolioPositionsCsv([basePortfolio()]);
    const header = csv.split('\n')[0]!.split(',');
    expect(header[CSV_INDEX.establishedAt]).toBe('Baseline Established At');
    expect(header[CSV_INDEX.collateralQuantity]).toBe('Baseline Collateral Quantity (BTC)');
    expect(header[CSV_INDEX.marketPriceUsd]).toBe('Baseline BTC Price (USD)');
    expect(header[CSV_INDEX.userMinHealthFactor]).toBe('Minimum Health Factor for Borrowing');
    expect(header[CSV_INDEX.targetDebtRatio]).toBe('Target Debt Ratio Ceiling');
    expect(header[CSV_INDEX.loopBorrowPercentage]).toBe('Loop Borrow Percentage');
    expect(header[CSV_INDEX.maxAcceptableAnnualInterestCost]).toBe(
      'Maximum Acceptable Annual Interest Cost (USD)',
    );
  });
});

/**
 * CSV/JSON cross-export consistency proof — v1.22.0 Batch 2 ("Portfolio
 * CSV Export Completeness, Part 2"). Extends the exact architecture
 * above (same `exportBothRepresentations`/`csvRowFor`/`jsonPayloadFor`
 * helpers, same `basePortfolio` fixture, same CSV_INDEX-driven by-index
 * lookup) to prove the four Safety Targets fields v1.22.0 Batch 1 newly
 * exposed in `buildPortfolioPositionsCsv`
 * (`targetHealthFactor`/`holdingPeriodDays`/`targetBtcPriceUsd`/
 * `safetyBufferPercent`) represent the same underlying persisted
 * `Portfolio.settings.safetyTargets` values the JSON exporter already
 * round-trips — test-only, no production file touched.
 *
 * **Same representation-difference discipline as the block above**: CSV
 * textualizes every field via its own existing `null` → `'Not available'`
 * convention; JSON's existing contract (an absent optional field is
 * simply not present on the serialized `payload` object) is read as-is,
 * never forced to match CSV's textual form.
 */
describe('CSV/JSON cross-export consistency — Safety Targets (v1.22.0 Batch 2)', () => {
  it('A. fully configured safetyTargets: all four values correspond exactly across CSV and JSON', async () => {
    const portfolio: Portfolio = {
      ...basePortfolio(),
      settings: {
        safetyTargets: {
          targetHealthFactor: 1.8,
          holdingPeriodDays: 90,
          targetBtcPriceUsd: 80000,
          safetyBufferPercent: 15,
        },
      },
    };

    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolio]);
    const csvFields = csvRowFor(csvLines, portfolio.id);
    const jsonPayload = jsonPayloadFor(jsonPortfolios, portfolio.id);
    const safetyTargets = jsonPayload.settings.safetyTargets!;

    expect(csvFields[CSV_INDEX.targetHealthFactor]).toBe('1.8');
    expect(safetyTargets.targetHealthFactor).toBe(1.8);

    expect(csvFields[CSV_INDEX.holdingPeriodDays]).toBe('90');
    expect(safetyTargets.holdingPeriodDays).toBe(90);

    expect(csvFields[CSV_INDEX.targetBtcPriceUsd]).toBe('80000');
    expect(safetyTargets.targetBtcPriceUsd).toBe(80000);

    expect(csvFields[CSV_INDEX.safetyBufferPercent]).toBe('15');
    expect(safetyTargets.safetyBufferPercent).toBe(15);
  });

  it('B. completely absent safetyTargets: CSV reports "Not available", JSON omits the property entirely (its own existing contract, unchanged)', async () => {
    const portfolio = basePortfolio();
    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolio]);
    const csvFields = csvRowFor(csvLines, portfolio.id);
    const jsonPayload = jsonPayloadFor(jsonPortfolios, portfolio.id);
    const rawSettings = jsonPayload.settings as unknown as Record<string, unknown>;

    expect(csvFields[CSV_INDEX.targetHealthFactor]).toBe('Not available');
    expect(csvFields[CSV_INDEX.holdingPeriodDays]).toBe('Not available');
    expect(csvFields[CSV_INDEX.targetBtcPriceUsd]).toBe('Not available');
    expect(csvFields[CSV_INDEX.safetyBufferPercent]).toBe('Not available');
    // JSON never invents an empty `safetyTargets` object to stand in for
    // "none configured" — the property itself is absent.
    expect('safetyTargets' in rawSettings).toBe(false);
  });

  it('C. partial safetyTargets: each field is independently consistent across both formats — no default/fallback appears in either', async () => {
    const portfolio: Portfolio = {
      ...basePortfolio(),
      settings: {
        safetyTargets: { targetHealthFactor: 1.5, targetBtcPriceUsd: 60000 }, // holdingPeriodDays/safetyBufferPercent deliberately absent
      },
    };

    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolio]);
    const csvFields = csvRowFor(csvLines, portfolio.id);
    const jsonPayload = jsonPayloadFor(jsonPortfolios, portfolio.id);
    const rawSafetyTargets = jsonPayload.settings.safetyTargets as unknown as Record<
      string,
      unknown
    >;

    expect(csvFields[CSV_INDEX.targetHealthFactor]).toBe('1.5');
    expect(jsonPayload.settings.safetyTargets?.targetHealthFactor).toBe(1.5);
    expect(csvFields[CSV_INDEX.holdingPeriodDays]).toBe('Not available');
    expect('holdingPeriodDays' in rawSafetyTargets).toBe(false);

    expect(csvFields[CSV_INDEX.targetBtcPriceUsd]).toBe('60000');
    expect(jsonPayload.settings.safetyTargets?.targetBtcPriceUsd).toBe(60000);
    expect(csvFields[CSV_INDEX.safetyBufferPercent]).toBe('Not available');
    expect('safetyBufferPercent' in rawSafetyTargets).toBe(false);
  });

  it('D. a valid zero (Holding Period (Days), Safety Buffer (%)) is preserved as a canonical zero in both exports, never mistaken for absence', async () => {
    // `holdingPeriodDays`/`safetyBufferPercent` both validate
    // `nonnegative()` (`types/portfolio.schema.ts`'s own
    // `portfolioSafetyTargetsSchema`) — 0 is a genuinely valid configured
    // value for both, unlike `targetHealthFactor`/`targetBtcPriceUsd`,
    // which validate strictly positive and so have no valid zero case to
    // test here (matching the same distinction the v1.21.0 Batch 3
    // describe block above already draws for its own fields).
    const portfolio: Portfolio = {
      ...basePortfolio(),
      settings: { safetyTargets: { holdingPeriodDays: 0, safetyBufferPercent: 0 } },
    };

    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolio]);
    const csvFields = csvRowFor(csvLines, portfolio.id);
    const jsonPayload = jsonPayloadFor(jsonPortfolios, portfolio.id);
    const safetyTargets = jsonPayload.settings.safetyTargets!;

    expect(csvFields[CSV_INDEX.holdingPeriodDays]).toBe('0');
    expect(csvFields[CSV_INDEX.holdingPeriodDays]).not.toBe('Not available');
    expect(safetyTargets.holdingPeriodDays).toBe(0);

    expect(csvFields[CSV_INDEX.safetyBufferPercent]).toBe('0');
    expect(csvFields[CSV_INDEX.safetyBufferPercent]).not.toBe('Not available');
    expect(safetyTargets.safetyBufferPercent).toBe(0);

    // Neither field with no valid zero case is accidentally populated.
    expect(csvFields[CSV_INDEX.targetHealthFactor]).toBe('Not available');
    expect(csvFields[CSV_INDEX.targetBtcPriceUsd]).toBe('Not available');
  });

  it('E. multiple portfolios with differing safety-target configurations: row/record identity and field alignment are preserved, no cross-row leakage', async () => {
    const portfolioA: Portfolio = {
      ...basePortfolio('portfolio-a'),
      settings: {
        safetyTargets: { targetHealthFactor: 2.0, holdingPeriodDays: 30 },
      },
    };
    const portfolioB: Portfolio = {
      ...basePortfolio('portfolio-b'),
      settings: {
        safetyTargets: { targetBtcPriceUsd: 100000, safetyBufferPercent: 0 },
      },
    };

    const { csvLines, jsonPortfolios } = await exportBothRepresentations([portfolioA, portfolioB]);
    expect(csvLines).toHaveLength(3); // header + 2 rows
    expect(jsonPortfolios).toHaveLength(2);

    const csvA = csvRowFor(csvLines, 'portfolio-a');
    const jsonA = jsonPayloadFor(jsonPortfolios, 'portfolio-a');
    expect(csvA[CSV_INDEX.targetHealthFactor]).toBe('2');
    expect(jsonA.settings.safetyTargets?.targetHealthFactor).toBe(2);
    expect(csvA[CSV_INDEX.holdingPeriodDays]).toBe('30');
    expect(jsonA.settings.safetyTargets?.holdingPeriodDays).toBe(30);
    // Portfolio A has no targetBtcPriceUsd/safetyBufferPercent configured
    // — must not pick up Portfolio B's own values in either representation.
    expect(csvA[CSV_INDEX.targetBtcPriceUsd]).toBe('Not available');
    expect(csvA[CSV_INDEX.safetyBufferPercent]).toBe('Not available');

    const csvB = csvRowFor(csvLines, 'portfolio-b');
    const jsonB = jsonPayloadFor(jsonPortfolios, 'portfolio-b');
    expect(csvB[CSV_INDEX.targetBtcPriceUsd]).toBe('100000');
    expect(jsonB.settings.safetyTargets?.targetBtcPriceUsd).toBe(100000);
    expect(csvB[CSV_INDEX.safetyBufferPercent]).toBe('0');
    expect(csvB[CSV_INDEX.safetyBufferPercent]).not.toBe('Not available');
    expect(jsonB.settings.safetyTargets?.safetyBufferPercent).toBe(0);
    // Portfolio B has no targetHealthFactor/holdingPeriodDays configured
    // — must not pick up Portfolio A's own values in either representation.
    expect(csvB[CSV_INDEX.targetHealthFactor]).toBe('Not available');
    expect(csvB[CSV_INDEX.holdingPeriodDays]).toBe('Not available');
  });

  it('confirms the four Safety Targets CSV column indices this describe block depends on, directly against the real header row', () => {
    const csv = buildPortfolioPositionsCsv([basePortfolio()]);
    const header = csv.split('\n')[0]!.split(',');
    expect(header[CSV_INDEX.targetHealthFactor]).toBe('Target Health Factor');
    expect(header[CSV_INDEX.holdingPeriodDays]).toBe('Holding Period (Days)');
    expect(header[CSV_INDEX.targetBtcPriceUsd]).toBe('Target BTC Price (USD)');
    expect(header[CSV_INDEX.safetyBufferPercent]).toBe('Safety Buffer (%)');
  });
});
