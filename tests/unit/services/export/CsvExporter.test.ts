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
