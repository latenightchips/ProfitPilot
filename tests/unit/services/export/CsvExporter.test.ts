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
 * 06_TASKS.md M9-034 ("Perform Input and Output Sanitization Review") —
 * a genuine CSV-injection gap found and fixed this batch:
 * `CsvExporter.ts`'s own header comment explains the guard;
 * `buildPortfolioPositionsCsv` is used here since `Name` is the one
 * genuinely free-text field it exports, but the guard lives in the
 * shared `csvLine` helper every `build*Csv` function routes through.
 */
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
    const csv = buildScenarioComparisonsCsv([
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
    ]);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('sim-1');
    expect(lines[1]).toContain('5000');
  });

  it('renders "Not available" for malformed or missing nested fields', () => {
    const csv = buildScenarioComparisonsCsv([{ id: 'sim-2' }]);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('Not available');
  });
});

describe('buildLoopStepsCsv', () => {
  it('emits one row per step across a strategy', () => {
    const csv = buildLoopStepsCsv([
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
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('strategy-1');
    expect(lines[2]).toContain('900');
  });

  it('emits one placeholder row for a strategy with no steps', () => {
    const csv = buildLoopStepsCsv([
      {
        id: 'strategy-1',
        name: 'Strategy',
        portfolioId: 'portfolio-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        result: { strategy: { steps: [] } },
      },
    ]);
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
    const csv = buildLoopStepsCsv([
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
    ]);
    expect(csv).not.toContain('privateKey');
    expect(csv).not.toContain('0xabc123');
    expect(csv).not.toContain('seedPhrase');
    expect(csv).not.toContain('wagon current bunker');
  });
});

describe('buildExitPlanBreakdownsCsv', () => {
  it('reads well-formed exit plan records structurally', () => {
    const csv = buildExitPlanBreakdownsCsv([
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
    ]);
    const lines = csv.split('\n');
    expect(lines[1]).toContain('plan-1');
    expect(lines[1]).toContain('true');
  });

  it('renders "Not available" for a malformed record rather than throwing', () => {
    expect(() => buildExitPlanBreakdownsCsv([null, 'not-an-object', 42])).not.toThrow();
    const csv = buildExitPlanBreakdownsCsv([null]);
    expect(csv.split('\n')[1]).toContain('Not available');
  });
});
