import { describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { calculatePortfolioSummary } from '@/services/portfolio/summary';
import { buildPortfolioHistoryEntry } from '@/services/portfolioHistory/buildPortfolioHistoryEntry';

/**
 * `buildPortfolioHistoryEntry` — V1.1 Batch 2. Uses the real
 * `calculatePortfolioSummary` (never a hand-built mock summary), the same
 * discipline `tests/unit/services/portfolio/summary.test.ts` establishes,
 * so these tests exercise the exact same values the rest of the
 * application actually computes and displays.
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

describe('buildPortfolioHistoryEntry — V3', () => {
  it('maps every field from ApplicationPortfolio/PortfolioSummary, no independent recalculation', () => {
    const portfolio = basePortfolio();
    const entry = buildPortfolioHistoryEntry(
      'portfolio-1',
      portfolio,
      summaryFor(portfolio),
      () => '2026-01-01T00:00:00.000Z',
    );

    expect(entry).toEqual({
      portfolioId: 'portfolio-1',
      protocolVersion: 'v3',
      createdAt: '2026-01-01T00:00:00.000Z',
      collateral: { quantity: 2, valueUsd: 100000 },
      debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
      marketPriceUsd: 50000,
      healthFactor: 4,
      liquidationPriceUsd: 12500,
      loanToValue: 0.2,
      leverage: expect.closeTo(1.25, 6),
      borrowApr: 0.05,
      supplyApr: 0.02,
      annualizedInterestCost: 1000,
      dataSource: 'manual',
    });
  });

  it('normalizes an Infinity Health Factor (zero-debt portfolio) to null, not a JSON-unsafe value', () => {
    const portfolio = basePortfolio({ debt: { asset: 'USDC', balance: 0 } });
    const summary = summaryFor(portfolio);
    expect(summary.healthFactor).toBe(Infinity);

    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, summary);
    expect(entry.healthFactor).toBeNull();
    expect(entry.liquidationPriceUsd).toBeNull();
  });

  it('V1.1 Batch 4: builds a valid, persistable entry for a full exit (zero collateral, zero debt) — no NaN, leverage 0, HF normalized to null', () => {
    const portfolio = basePortfolio({
      collateral: { asset: 'BTC', quantity: 0 },
      debt: { asset: 'USDC', balance: 0 },
    });
    const summary = summaryFor(portfolio);
    expect(summary.leverage).toBe(0);
    expect(summary.healthFactor).toBe(Infinity);

    const entry = buildPortfolioHistoryEntry(
      'portfolio-1',
      portfolio,
      summary,
      () => '2026-01-01T00:00:00.000Z',
    );

    expect(entry).toEqual({
      portfolioId: 'portfolio-1',
      protocolVersion: 'v3',
      createdAt: '2026-01-01T00:00:00.000Z',
      collateral: { quantity: 0, valueUsd: 0 },
      debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      marketPriceUsd: 50000,
      healthFactor: null,
      liquidationPriceUsd: null,
      loanToValue: 0,
      leverage: 0,
      borrowApr: 0.05,
      supplyApr: 0.02,
      annualizedInterestCost: 0,
      dataSource: 'manual',
    });
    for (const value of Object.values(entry.collateral)) {
      expect(Number.isNaN(value)).toBe(false);
    }
    expect(Number.isNaN(entry.leverage)).toBe(false);
    expect(Number.isNaN(entry.loanToValue)).toBe(false);
  });

  it('reports dataSource "live" when market or protocol data is live-sourced', () => {
    const portfolio = basePortfolio({ marketSource: 'live' });
    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, summaryFor(portfolio));
    expect(entry.dataSource).toBe('live');
  });

  it('reports dataSource "manual" when no field is live-sourced', () => {
    const portfolio = basePortfolio();
    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, summaryFor(portfolio));
    expect(entry.dataSource).toBe('manual');
  });
});

describe('buildPortfolioHistoryEntry — V4 isolation', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
      ...overrides,
    });
  }

  it('tags the entry protocolVersion "v4" and derives debt quantity from v4DebtState, never legacy debt.balance', () => {
    const portfolio = v4Portfolio({ debt: { asset: 'USDC', balance: 999999 } });
    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, summaryFor(portfolio));
    expect(entry.protocolVersion).toBe('v4');
    // drawnDebt + premiumDebt = 15000 + 500, not the legacy 999999 balance.
    expect(entry.debt.quantity).toBe(15500);
    expect(entry.debt.valueUsd).toBe(15500);
  });

  it('falls back to legacy debt.balance (never a fabricated non-zero) for a V4 portfolio with no synced debt state', () => {
    const portfolio = basePortfolio({ protocolVersion: 'v4', debt: { asset: 'USDC', balance: 0 } });
    // calculatePortfolioSummary fails closed for a V4 portfolio with no
    // v4DebtState — the Store's own `attemptHistorySnapshot` guards on
    // `summary.ok` for exactly this case, so `buildPortfolioHistoryEntry`
    // is never actually called with this input in production. This test
    // only proves the pure debt-quantity helper's own fallback branch
    // (unreachable via calculatePortfolioSummary) does not fabricate a
    // non-zero quantity, by calling it with a synthetic summary directly.
    const syntheticSummary = {
      collateralValue: 100000,
      debtValue: 0,
      netEquity: 100000,
      loanToValue: 0,
      leverage: 1,
      healthFactor: Infinity,
      liquidation: null,
      interestCost: 0,
    };
    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, syntheticSummary);
    expect(entry.debt.quantity).toBe(0);
    expect(entry.borrowApr).toBeUndefined();
  });

  it('a V3 portfolio never reads a V4 field even when one happens to be present (no cross-inference)', () => {
    const portfolio = basePortfolio({
      protocolVersion: 'v3',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    });
    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, summaryFor(portfolio));
    expect(entry.protocolVersion).toBe('v3');
    expect(entry.debt.quantity).toBe(20000);
    expect(entry.borrowApr).toBe(0.05);
  });
});

describe('buildPortfolioHistoryEntry — V4 dataSource provenance polarity (V4 Mixed-Provenance UX batch, requirement F)', () => {
  // `debtAssetPriceUsd` is required whenever `v4DebtStateSource` is 'live'
  // — `checkAaveV4DebtAssetPriceAvailable` (services/portfolio/mapping.ts)
  // fails the summary calculation closed otherwise. Included here so every
  // "live debt state" scenario below produces a real summary, not a setup
  // failure, matching how a genuine live-synced record is actually shaped.
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: {
        drawnDebt: 15000,
        premiumDebt: 500,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 1,
      },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
      ...overrides,
    });
  }

  it('reports "manual" — never "live" — when debt state and base drawn APR are live-sourced but collateral risk is manual (all three must agree for "live")', () => {
    const portfolio = v4Portfolio({
      v4DebtStateSource: 'live',
      v4BaseDrawnAprSource: 'live',
      v4CollateralRiskSource: 'manual',
    });
    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, summaryFor(portfolio));
    expect(entry.dataSource).toBe('manual');
  });

  it('reports "manual" — never "live" — when debt state and collateral risk are live-sourced but base drawn APR is manual', () => {
    const portfolio = v4Portfolio({
      v4DebtStateSource: 'live',
      v4BaseDrawnAprSource: 'manual',
      v4CollateralRiskSource: 'live',
    });
    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, summaryFor(portfolio));
    expect(entry.dataSource).toBe('manual');
  });

  it('reports "manual" for a historical V4 record with no v4BaseDrawnAprSource at all — backward-compatible default, never inferred live', () => {
    const portfolio = v4Portfolio({
      v4DebtStateSource: 'live',
      v4CollateralRiskSource: 'live',
    });
    expect(portfolio.v4BaseDrawnAprSource).toBeUndefined();
    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, summaryFor(portfolio));
    expect(entry.dataSource).toBe('manual');
  });

  it('reports "live" only when debt state, base drawn APR, and collateral risk are all live-sourced', () => {
    const portfolio = v4Portfolio({
      v4DebtStateSource: 'live',
      v4BaseDrawnAprSource: 'live',
      v4CollateralRiskSource: 'live',
    });
    const entry = buildPortfolioHistoryEntry('portfolio-1', portfolio, summaryFor(portfolio));
    expect(entry.dataSource).toBe('live');
  });
});
