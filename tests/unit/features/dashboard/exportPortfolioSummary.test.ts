import { describe, expect, it, vi } from 'vitest';

import type { DashboardMetrics } from '@/features/dashboard';
import {
  buildPortfolioSummaryCsv,
  buildPortfolioSummaryExport,
  downloadPortfolioSummaryCsv,
  downloadPortfolioSummaryJson,
} from '@/features/dashboard';

/**
 * Portfolio Summary export — 06_TASKS.md M5-016, "Export portfolio" Action item.
 */
function metric(label: string, formattedValue: string) {
  return { label, rawValue: 1, formattedValue, status: 'ok' as const, formulaId: null };
}

const METRICS: DashboardMetrics = {
  netPortfolioValue: metric('Net Portfolio Value', '$80,000.00'),
  totalCollateral: metric('Total Collateral', '$100,000.00'),
  totalDebt: metric('Total Debt', '$20,000.00'),
  healthFactor: metric('Health Factor', '3.20'),
  loanToValue: metric('Loan-to-Value', '20.00%'),
  leverage: metric('Effective Leverage', '1.25x'),
  annualInterestCost: metric('Annual Interest Cost', '$1,000.00'),
  liquidationPrice: metric('Liquidation Price', '$25,000.00'),
  liquidationDistance: metric('Distance to Liquidation', '2.20'),
  liquidationBuffer: metric('Liquidation Buffer', '220.00%'),
};

describe('buildPortfolioSummaryExport', () => {
  it('includes schema version, timestamps, and all 10 metrics', () => {
    const result = buildPortfolioSummaryExport('My Portfolio', '2026-07-27T00:00:00.000Z', METRICS);

    expect(result.schemaVersion).toBe('0.1.0');
    expect(result.portfolioName).toBe('My Portfolio');
    expect(result.calculationTimestamp).toBe('2026-07-27T00:00:00.000Z');
    expect(result.metrics).toHaveLength(10);
    expect(result.metrics[0]).toEqual({ label: 'Net Portfolio Value', value: '$80,000.00' });
  });
});

describe('buildPortfolioSummaryCsv', () => {
  it('quotes every field, matching RFC 4180', () => {
    const csv = buildPortfolioSummaryCsv('My Portfolio', '2026-07-27T00:00:00.000Z', METRICS);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('"Portfolio","My Portfolio"');
    expect(lines[1]).toBe('"Calculated","2026-07-27T00:00:00.000Z"');
    expect(lines[2]).toBe('');
    expect(lines[3]).toBe('"Metric","Value"');
    expect(lines[4]).toBe('"Net Portfolio Value","$80,000.00"');
  });
});

describe('download triggers', () => {
  function stubBrowserApis() {
    const click = vi.fn();
    const realCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') element.click = click;
      return element;
    });
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
    return click;
  }

  it('downloadPortfolioSummaryJson triggers a real download', () => {
    const click = stubBrowserApis();
    downloadPortfolioSummaryJson('abc123', 'My Portfolio', '2026-07-27T00:00:00.000Z', METRICS);
    expect(click).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('downloadPortfolioSummaryCsv triggers a real download', () => {
    const click = stubBrowserApis();
    downloadPortfolioSummaryCsv('abc123', 'My Portfolio', '2026-07-27T00:00:00.000Z', METRICS);
    expect(click).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
