import { describe, expect, it } from 'vitest';

import {
  buildExitPlanBreakdownsCsv,
  buildLoopStepsCsv,
  buildPortfolioPositionsCsv,
  buildScenarioComparisonsCsv,
} from '@/services/export/CsvExporter';
import type { Portfolio } from '@/types/portfolio';

function samplePortfolio(): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'My, "Special" Portfolio',
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

describe('buildPortfolioPositionsCsv', () => {
  it('includes a header row and one row per portfolio', () => {
    const csv = buildPortfolioPositionsCsv([samplePortfolio()]);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Portfolio ID');
    expect(lines).toHaveLength(2);
  });

  it('quotes and escapes fields containing commas or quotes', () => {
    const csv = buildPortfolioPositionsCsv([samplePortfolio()]);
    expect(csv).toContain('"My, ""Special"" Portfolio"');
  });

  it('produces only a header row for an empty list', () => {
    const csv = buildPortfolioPositionsCsv([]);
    expect(csv.split('\n')).toHaveLength(1);
  });
});

/**
 * "Debt Balance (USD)"/"Borrow APR" columns for a V4 portfolio — V4
 * Readiness Audit §12 Stage 16. `debt.balance`/`protocol.borrowApr`
 * deliberately disagree with the real synced `v4DebtState` below,
 * proving the export uses the canonical values (`resolveCanonicalDebtBalance`/
 * Stage 15's `deriveAaveV4EffectiveBorrowRate`), not the stale legacy
 * fields.
 */
describe('buildPortfolioPositionsCsv — V4 canonical debt balance and borrow rate (Stage 16)', () => {
  function sampleV4Portfolio(v4DebtState?: {
    drawnDebt: number;
    premiumDebt: number;
    baseDrawnApr: number;
    riskPremium: number;
  }): Portfolio {
    return {
      ...samplePortfolio(),
      name: 'V4 Portfolio',
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      ...(v4DebtState !== undefined && { v4DebtState }),
    };
  }

  it('exports the canonical debt total and derived rate, not the deliberately-disagreeing legacy fields', () => {
    const csv = buildPortfolioPositionsCsv([
      sampleV4Portfolio({
        drawnDebt: 20000,
        premiumDebt: 500,
        baseDrawnApr: 0.05,
        riskPremium: 0.1,
      }),
    ]);
    const lines = csv.split('\n');
    // Canonical total: 20000 + 500 = 20500 (never the stale 999999).
    expect(lines[1]).toContain(',20500,');
    expect(lines[1]).not.toContain('999999');
    // Same Stage 10/15 regression vector: annualCost 1100 / totalDebt 20500 ≈ 0.05365853658536585.
    expect(lines[1]).toContain('0.05365853658536585');
    expect(lines[1]).not.toContain(',0.05,');
  });

  it('exports "Not available" for both columns when v4DebtState has not synced yet, never the stale legacy fields', () => {
    const csv = buildPortfolioPositionsCsv([sampleV4Portfolio()]);
    const lines = csv.split('\n');
    const fields = lines[1]!.split(',');
    // Debt Balance (USD) is column index 5, Borrow APR is column index 10
    // (Portfolio ID, Name, Collateral Asset, Collateral Quantity, Debt
    // Asset, Debt Balance, BTC Price, Max LTV, Liquidation Threshold,
    // Collateral Factor [Stage 23E], Borrow APR).
    expect(fields[5]).toBe('Not available');
    expect(fields[10]).toBe('Not available');
    expect(csv).not.toContain('999999');
  });

  it('a V3 (or unset) portfolio is completely unaffected — still exports the raw legacy fields directly', () => {
    const csv = buildPortfolioPositionsCsv([samplePortfolio()]);
    const lines = csv.split('\n');
    expect(lines[1]).toContain(',20000,');
    expect(lines[1]).toContain(',0.05,');
  });
});

/**
 * "Max LTV"/"Liquidation Threshold"/"Collateral Factor" columns — V4
 * Readiness Audit §12 Stage 23E. `collateralFactor: 0.65` deliberately
 * differs from `samplePortfolio()`'s own `protocol.liquidationThreshold: 0.8`,
 * so a test that silently used the V3 field would fail on an exact
 * numeric mismatch.
 */
describe('buildPortfolioPositionsCsv — V4 risk-capacity columns (Stage 23E)', () => {
  function sampleV4PortfolioWithRisk(collateralFactor: number): Portfolio {
    return {
      ...samplePortfolio(),
      name: 'V4 Portfolio',
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor, dynamicConfigKey: 1 },
    };
  }

  it('exports "Not available" for Max LTV/Liquidation Threshold and the real value for Collateral Factor, for a V4 portfolio', () => {
    const csv = buildPortfolioPositionsCsv([sampleV4PortfolioWithRisk(0.65)]);
    const lines = csv.split('\n');
    const fields = lines[1]!.split(',');
    // Max LTV index 7, Liquidation Threshold index 8, Collateral Factor index 9.
    expect(fields[7]).toBe('Not available');
    expect(fields[8]).toBe('Not available');
    expect(fields[9]).toBe('0.65');
  });

  it('exports "Not available" for Collateral Factor when v4CollateralRisk has not synced, never falling back to a V3 number', () => {
    const noRiskPortfolio: Portfolio = {
      ...sampleV4PortfolioWithRisk(0.65),
      v4CollateralRisk: undefined,
    };
    const csv = buildPortfolioPositionsCsv([noRiskPortfolio]);
    const lines = csv.split('\n');
    const fields = lines[1]!.split(',');
    expect(fields[9]).toBe('Not available');
  });

  it('a V3 row and a V4 row in the same export each show only their own protocol-relevant columns', () => {
    // A comma-free name here — samplePortfolio()'s own name contains a
    // comma, which csvEscape correctly quotes but would throw off this
    // test's own naive `.split(',')` column counting.
    const csv = buildPortfolioPositionsCsv([
      { ...samplePortfolio(), name: 'V3 Portfolio' },
      sampleV4PortfolioWithRisk(0.65),
    ]);
    const lines = csv.split('\n');
    const v3Fields = lines[1]!.split(',');
    const v4Fields = lines[2]!.split(',');
    expect(v3Fields[7]).toBe('0.75'); // Max LTV
    expect(v3Fields[8]).toBe('0.8'); // Liquidation Threshold
    expect(v3Fields[9]).toBe('Not available'); // Collateral Factor
    expect(v4Fields[7]).toBe('Not available'); // Max LTV
    expect(v4Fields[8]).toBe('Not available'); // Liquidation Threshold
    expect(v4Fields[9]).toBe('0.65'); // Collateral Factor
  });
});

/**
 * "Supply APR" column — V4 Readiness Audit §12 P1-1. No V4 boundary this
 * codebase talks to exposes an authoritative supply rate, so a live V4
 * portfolio must never export the inherited/leftover `protocol.supplyApr`
 * figure. Column index 11 (Portfolio ID, Name, Collateral Asset,
 * Collateral Quantity, Debt Asset, Debt Balance, BTC Price, Max LTV,
 * Liquidation Threshold, Collateral Factor, Borrow APR, Supply APR).
 */
describe('buildPortfolioPositionsCsv — Supply APR (P1-1)', () => {
  function sampleV4PortfolioWithRiskSource(
    v4CollateralRiskSource: 'manual' | 'live' | undefined,
  ): Portfolio {
    return {
      ...samplePortfolio(),
      name: 'V4 Portfolio',
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
      v4CollateralRiskSource,
    };
  }

  it('exports "Not available" for a live V4 portfolio, never the leftover protocol.supplyApr (0.02)', () => {
    const csv = buildPortfolioPositionsCsv([sampleV4PortfolioWithRiskSource('live')]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[11]).toBe('Not available');
  });

  it('exports "Not available" for a V4 portfolio with no v4CollateralRiskSource yet (not-yet-synced)', () => {
    const csv = buildPortfolioPositionsCsv([sampleV4PortfolioWithRiskSource(undefined)]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[11]).toBe('Not available');
  });

  it('exports the real protocol.supplyApr for a manual V4 portfolio, manual semantics preserved', () => {
    const csv = buildPortfolioPositionsCsv([sampleV4PortfolioWithRiskSource('manual')]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[11]).toBe('0.02');
  });

  it('a V3 portfolio is completely unaffected — still exports the raw protocol.supplyApr directly', () => {
    // Comma-free name — samplePortfolio()'s own name contains a comma,
    // which would throw off this test's own naive `.split(',')` column
    // counting (see the V4 risk-capacity describe block above's own
    // identical note).
    const csv = buildPortfolioPositionsCsv([{ ...samplePortfolio(), name: 'V3 Portfolio' }]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[11]).toBe('0.02');
  });
});

/**
 * 06_TASKS.md M9-034 ("Perform Input and Output Sanitization Review") —
 * a genuine CSV-injection gap found and fixed this batch:
 * `CsvExporter.ts`'s own header comment explains the guard;
 * `buildPortfolioPositionsCsv` is used here since `Name` is the one
 * genuinely free-text field it exports, but the guard lives in the
 * shared `csvLine` helper every `build*Csv` function routes through.
 */
/**
 * "Swap Fee Assumption"/"Slippage Assumption"/"Gas Cost Assumption"
 * columns — V4 Readiness Audit §12 P1-6. Column indices 12, 13, 14
 * (appended after "Supply APR" at index 11 — see that describe block
 * above — so every existing column index before it is unaffected).
 */
describe('buildPortfolioPositionsCsv — execution-cost assumptions (P1-6)', () => {
  // Comma-free name — samplePortfolio()'s own name contains a comma
  // (quoted in the real CSV), which would throw off a naive
  // `.split(',')` index count in these tests, the same reasoning the
  // "Supply APR (P1-1)" describe block above already documents.
  it('exports "Not available" for each field when no execution-cost assumptions are configured', () => {
    const csv = buildPortfolioPositionsCsv([{ ...samplePortfolio(), name: 'V3 Portfolio' }]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[12]).toBe('Not available');
    expect(fields[13]).toBe('Not available');
    expect(fields[14]).toBe('Not available');
  });

  it('exports the real configured values when execution-cost assumptions are set', () => {
    const csv = buildPortfolioPositionsCsv([
      {
        ...samplePortfolio(),
        name: 'V3 Portfolio',
        settings: {
          executionCostAssumptions: { swapFeeRate: 0.003, slippageRate: 0.005, gasCostUsd: 15 },
        },
      },
    ]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[12]).toBe('0.003');
    expect(fields[13]).toBe('0.005');
    expect(fields[14]).toBe('15');
  });

  it('exports each field independently — gas configured alone leaves the two rates "Not available"', () => {
    const csv = buildPortfolioPositionsCsv([
      {
        ...samplePortfolio(),
        name: 'V3 Portfolio',
        settings: { executionCostAssumptions: { gasCostUsd: 8 } },
      },
    ]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[12]).toBe('Not available');
    expect(fields[13]).toBe('Not available');
    expect(fields[14]).toBe('8');
  });
});

/**
 * "Protocol Version"/"V4 Debt State Source"/"V4 Debt State Updated At"/
 * "V4 Collateral Risk Source"/"V4 Collateral Risk Updated At"/
 * "V4 Data Stale At Export" columns — V4 Readiness Audit §12 P2-1.
 * `resolveExportProvenance`'s own dedicated unit tests cover the resolver
 * logic itself; these only confirm the columns are wired at the correct
 * indices, matching this file's own by-index testing convention (see the
 * "execution-cost assumptions" describe block above for why: this file's
 * fixture name contains a comma).
 */
describe('buildPortfolioPositionsCsv — export provenance (P2-1)', () => {
  it('exports "Not available" for every V4 provenance field on a V3 (or unset) portfolio', () => {
    const csv = buildPortfolioPositionsCsv([{ ...samplePortfolio(), name: 'V3 Portfolio' }]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[15]).toBe('v3');
    expect(fields[16]).toBe('Not available'); // V4 Debt State Source
    expect(fields[17]).toBe('Not available'); // V4 Debt State Updated At
    expect(fields[18]).toBe('Not available'); // V4 Collateral Risk Source
    expect(fields[19]).toBe('Not available'); // V4 Collateral Risk Updated At
    expect(fields[20]).toBe('Not available'); // V4 Base Drawn APR Source
    // Market Data Source/Updated At — V4 Mixed-Provenance UX batch.
    // `marketSource` is unset on `samplePortfolio()`, but `marketUpdatedAt`
    // is always present (never optional on `Portfolio`).
    expect(fields[21]).toBe('Not available'); // Market Data Source
    expect(fields[22]).toBe('2026-01-01T00:00:00.000Z'); // Market Data Updated At
    expect(fields[23]).toBe('Not available'); // V4 Data Stale At Export
  });

  it('identifies manual V4 provenance', () => {
    const csv = buildPortfolioPositionsCsv([
      {
        ...samplePortfolio(),
        name: 'V3 Portfolio',
        protocolVersion: 'v4',
        v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
        v4DebtStateSource: 'manual',
        v4DebtStateUpdatedAt: '2026-08-25T11:00:00.000Z',
      },
    ]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[15]).toBe('v4');
    expect(fields[16]).toBe('manual');
    expect(fields[17]).toBe('2026-08-25T11:00:00.000Z');
  });

  it('identifies live V4 provenance and reports fresh/stale correctly', () => {
    const csv = buildPortfolioPositionsCsv([
      {
        ...samplePortfolio(),
        name: 'V3 Portfolio',
        protocolVersion: 'v4',
        v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
        v4DebtStateSource: 'live',
        v4DebtStateUpdatedAt: new Date().toISOString(),
      },
    ]);
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields[16]).toBe('live');
    expect(fields[23]).toBe('false'); // V4 Data Stale At Export
  });

  it('names the new truthful source columns verbatim in the CSV header row (V4 Mixed-Provenance UX batch, requirement G)', () => {
    const csv = buildPortfolioPositionsCsv([samplePortfolio()]);
    const headerFields = csv.split('\n')[0]!.split(',');
    expect(headerFields).toContain('V4 Base Drawn APR Source');
    expect(headerFields).toContain('Market Data Source');
    expect(headerFields).toContain('Market Data Updated At');
  });
});

describe('CSV formula-injection guard (M9-034)', () => {
  it('prefixes a portfolio name beginning with "=" so spreadsheet software does not treat it as a formula', () => {
    const csv = buildPortfolioPositionsCsv([{ ...samplePortfolio(), name: '=cmd|"/c calc"!A1' }]);
    expect(csv).toContain("'=cmd");
    expect(csv).not.toContain('\n=cmd');
  });

  it('prefixes names beginning with "+", "@", or a tab the same way', () => {
    for (const dangerous of ['+1+1', '@SUM(A1:A9)', '\tmalicious']) {
      const csv = buildPortfolioPositionsCsv([{ ...samplePortfolio(), name: dangerous }]);
      expect(csv).toContain(`'${dangerous}`);
    }
  });

  it('does not guard a legitimate negative number field (debt balance), which is typed as a number, not a string', () => {
    const csv = buildPortfolioPositionsCsv([
      { ...samplePortfolio(), debt: { asset: 'USDC', balance: -500 } },
    ]);
    const lines = csv.split('\n');
    // The raw, un-prefixed negative number must still be present verbatim.
    expect(lines[1]).toContain(',-500,');
    expect(lines[1]).not.toContain("'-500");
  });

  it('leaves an ordinary name beginning with a hyphen (a legitimate, if unusual, portfolio name) prefixed for safety, consistent with every other trigger character', () => {
    const csv = buildPortfolioPositionsCsv([{ ...samplePortfolio(), name: '-my portfolio' }]);
    expect(csv).toContain("'-my portfolio");
  });
});

describe('buildScenarioComparisonsCsv', () => {
  it('reads well-formed simulation records structurally', () => {
    const csv = buildScenarioComparisonsCsv(
      [
        {
          id: 'sim-1',
          name: 'Bull case',
          portfolioId: 'portfolio-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          scenario: { type: 'btcPriceTarget' },
          result: {
            baseline: { equity: 10000, healthFactor: 1.5 },
            scenario: { equity: 15000, healthFactor: 2, profitOrLoss: 5000 },
          },
        },
      ],
      [],
    );
    const lines = csv.split('\n');
    expect(lines[1]).toContain('sim-1');
    expect(lines[1]).toContain('5000');
  });

  it('renders "Not available" for malformed or missing nested fields', () => {
    const csv = buildScenarioComparisonsCsv([{ id: 'sim-2' }], []);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('Not available');
  });
});

/**
 * Export provenance for the referenced portfolio — V4 Readiness Audit §12
 * P2-2, extending P2-1's `buildPortfolioPositionsCsv` provenance columns
 * to this collection-level export by cross-referencing each record's own
 * `portfolioId`. `resolveExportProvenance`'s own dedicated unit tests
 * cover the resolver logic itself; these only confirm the lookup/column
 * wiring.
 */
describe('buildScenarioComparisonsCsv — export provenance (P2-2)', () => {
  it('reports "Not available" for every provenance column when the referenced portfolio is not found', () => {
    const csv = buildScenarioComparisonsCsv(
      [{ id: 'sim-1', portfolioId: 'missing-portfolio' }],
      [],
    );
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields.slice(-9)).toEqual(Array(9).fill('Not available'));
  });

  it('resolves real provenance for a V4 portfolio found in the referenced list', () => {
    const v4Portfolio: Portfolio = {
      ...samplePortfolio(),
      name: 'V4 Portfolio',
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4DebtStateSource: 'manual',
      v4DebtStateUpdatedAt: '2026-08-25T11:00:00.000Z',
    };
    const csv = buildScenarioComparisonsCsv(
      [{ id: 'sim-1', portfolioId: 'portfolio-1' }],
      [v4Portfolio],
    );
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields.slice(-9)).toEqual([
      'v4',
      'manual',
      '2026-08-25T11:00:00.000Z',
      'Not available', // V4 Collateral Risk Source
      'Not available', // V4 Collateral Risk Updated At
      'Not available', // V4 Base Drawn APR Source
      'Not available', // Market Data Source (unset on the fixture)
      '2026-01-01T00:00:00.000Z', // Market Data Updated At (always present on Portfolio)
      'Not available', // V4 Data Stale At Export
    ]);
  });

  it('resolves v3 provenance for an unversioned portfolio, never fabricating V4 fields', () => {
    const csv = buildScenarioComparisonsCsv(
      [{ id: 'sim-1', portfolioId: 'portfolio-1' }],
      [samplePortfolio()],
    );
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields.slice(-9)).toEqual([
      'v3',
      'Not available',
      'Not available',
      'Not available',
      'Not available',
      'Not available', // V4 Base Drawn APR Source
      'Not available', // Market Data Source (unset on the fixture)
      '2026-01-01T00:00:00.000Z', // Market Data Updated At (always present on Portfolio)
      'Not available', // V4 Data Stale At Export
    ]);
  });
});

describe('buildLoopStepsCsv', () => {
  it('emits one row per step across a strategy', () => {
    const csv = buildLoopStepsCsv(
      [
        {
          id: 'strategy-1',
          name: 'Strategy',
          portfolioId: 'portfolio-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          result: {
            strategy: {
              steps: [
                {
                  stepNumber: 1,
                  borrowedAmount: 1000,
                  btcPurchased: 0.02,
                  collateralAfter: { quantity: 2.02 },
                },
                {
                  stepNumber: 2,
                  borrowedAmount: 900,
                  btcPurchased: 0.018,
                  collateralAfter: { quantity: 2.038 },
                },
              ],
            },
          },
        },
      ],
      [],
    );
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('strategy-1');
    expect(lines[2]).toContain('900');
  });

  it('emits one placeholder row for a strategy with no steps', () => {
    const csv = buildLoopStepsCsv(
      [
        {
          id: 'strategy-1',
          name: 'Strategy',
          portfolioId: 'portfolio-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          result: { strategy: { steps: [] } },
        },
      ],
      [],
    );
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Not available');
  });

  /**
   * 06_TASKS.md M9-033 ("Audit Export Privacy") — defense-in-depth
   * beyond `services/shared/sensitiveFields.ts`'s own write/import-time
   * rejection (M8-051), which already stops a sensitive field from ever
   * being persisted in the first place. This test proves the CSV
   * exporter itself is structurally incapable of leaking one even if it
   * somehow existed in a record's loose `result` object — `csvLine`
   * only ever reads the specific named fields each `build*Csv` function
   * lists (`stepNumber`/`borrowedAmount`/`btcPurchased`/
   * `collateralAfter.quantity` here), never a raw dump of `result`
   * itself, so a field like `result.wallet.privateKey` has no path into
   * the output regardless of whether it's present in the source data.
   */
  it('never includes an arbitrary field from the loose result object, even one shaped like a credential', () => {
    const csv = buildLoopStepsCsv(
      [
        {
          id: 'strategy-1',
          name: 'Strategy',
          portfolioId: 'portfolio-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          result: {
            wallet: { privateKey: '0xabc123', seedPhrase: 'wagon current bunker...' },
            strategy: {
              steps: [
                {
                  stepNumber: 1,
                  borrowedAmount: 1000,
                  btcPurchased: 0.02,
                  collateralAfter: { quantity: 2.02 },
                },
              ],
            },
          },
        },
      ],
      [],
    );
    expect(csv).not.toContain('privateKey');
    expect(csv).not.toContain('0xabc123');
    expect(csv).not.toContain('seedPhrase');
    expect(csv).not.toContain('wagon current bunker');
  });
});

/**
 * Export provenance for the referenced portfolio — V4 Readiness Audit §12
 * P2-2. Same reasoning as `buildScenarioComparisonsCsv`'s own provenance
 * describe block above; every row for a given strategy (including the
 * no-steps placeholder row) carries the same resolved provenance.
 */
describe('buildLoopStepsCsv — export provenance (P2-2)', () => {
  it('reports "Not available" for every provenance column when the referenced portfolio is not found', () => {
    const csv = buildLoopStepsCsv(
      [
        {
          id: 'strategy-1',
          portfolioId: 'missing-portfolio',
          result: { strategy: { steps: [] } },
        },
      ],
      [],
    );
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields.slice(-9)).toEqual(Array(9).fill('Not available'));
  });

  it('resolves real provenance for a live V4 portfolio, applied to every step row', () => {
    const v4Portfolio: Portfolio = {
      ...samplePortfolio(),
      name: 'V4 Portfolio',
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4DebtStateSource: 'live',
      v4DebtStateUpdatedAt: new Date().toISOString(),
    };
    const csv = buildLoopStepsCsv(
      [
        {
          id: 'strategy-1',
          portfolioId: 'portfolio-1',
          result: {
            strategy: {
              steps: [
                { stepNumber: 1, borrowedAmount: 1000, btcPurchased: 0.02 },
                { stepNumber: 2, borrowedAmount: 900, btcPurchased: 0.018 },
              ],
            },
          },
        },
      ],
      [v4Portfolio],
    );
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    const step1Fields = lines[1]!.split(',');
    const step2Fields = lines[2]!.split(',');
    expect(step1Fields.slice(-9)[0]).toBe('v4');
    expect(step1Fields.slice(-9)[1]).toBe('live');
    expect(step1Fields.slice(-9)[8]).toBe('false'); // V4 Data Stale At Export
    expect(step2Fields.slice(-9)[0]).toBe('v4');
  });
});

describe('buildExitPlanBreakdownsCsv', () => {
  it('reads well-formed exit plan records structurally', () => {
    const csv = buildExitPlanBreakdownsCsv(
      [
        {
          id: 'plan-1',
          name: 'Full exit',
          portfolioId: 'portfolio-1',
          exitType: 'fullExit',
          createdAt: '2026-01-01T00:00:00.000Z',
          result: {
            feasible: true,
            before: { netEquity: 10000 },
            after: { netEquity: 9000 },
            transaction: { repayment: 5000, btcSold: 0.1, btcRetained: 0 },
          },
        },
      ],
      [],
    );
    const lines = csv.split('\n');
    expect(lines[1]).toContain('plan-1');
    expect(lines[1]).toContain('true');
  });

  it('renders "Not available" for a malformed record rather than throwing', () => {
    expect(() => buildExitPlanBreakdownsCsv([null, 'not-an-object', 42], [])).not.toThrow();
    const csv = buildExitPlanBreakdownsCsv([null], []);
    expect(csv.split('\n')[1]).toContain('Not available');
  });
});

/**
 * Export provenance for the referenced portfolio — V4 Readiness Audit §12
 * P2-2. Same reasoning as `buildScenarioComparisonsCsv`'s own provenance
 * describe block above.
 */
describe('buildExitPlanBreakdownsCsv — export provenance (P2-2)', () => {
  it('reports "Not available" for every provenance column when the referenced portfolio is not found', () => {
    const csv = buildExitPlanBreakdownsCsv(
      [{ id: 'plan-1', portfolioId: 'missing-portfolio' }],
      [],
    );
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields.slice(-9)).toEqual(Array(9).fill('Not available'));
  });

  it('resolves real provenance for a manual V4 portfolio found in the referenced list', () => {
    const v4Portfolio: Portfolio = {
      ...samplePortfolio(),
      name: 'V4 Portfolio',
      protocolVersion: 'v4',
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
      v4CollateralRiskSource: 'manual',
      v4CollateralRiskUpdatedAt: '2026-08-25T11:00:00.000Z',
    };
    const csv = buildExitPlanBreakdownsCsv(
      [{ id: 'plan-1', portfolioId: 'portfolio-1' }],
      [v4Portfolio],
    );
    const fields = csv.split('\n')[1]!.split(',');
    expect(fields.slice(-9)).toEqual([
      'v4',
      'Not available', // V4 Debt State Source
      'Not available', // V4 Debt State Updated At
      'manual',
      '2026-08-25T11:00:00.000Z',
      'Not available', // V4 Base Drawn APR Source (no v4DebtState on this fixture)
      'Not available', // Market Data Source (unset on the fixture)
      '2026-01-01T00:00:00.000Z', // Market Data Updated At (always present on Portfolio)
      'Not available', // V4 Data Stale At Export
    ]);
  });
});
