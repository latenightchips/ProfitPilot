import { describe, expect, it } from 'vitest';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';
import { comparePortfolioHistoryEntries } from '@/services/portfolioHistory/comparePortfolioHistoryEntries';

function entry(
  overrides: Partial<PersistedPortfolioHistoryEntry> = {},
): PersistedPortfolioHistoryEntry {
  return {
    portfolioId: 'portfolio-1',
    protocolVersion: 'v3',
    createdAt: '2026-01-01T00:00:00.000Z',
    collateral: { quantity: 2, valueUsd: 100000 },
    debt: { asset: 'USDC', quantity: 20000, valueUsd: 20000 },
    marketPriceUsd: 50000,
    healthFactor: 4,
    liquidationPriceUsd: 12500,
    loanToValue: 0.2,
    leverage: 1.25,
    borrowApr: 0.05,
    supplyApr: 0.02,
    annualizedInterestCost: 1000,
    dataSource: 'manual',
    ...overrides,
  };
}

describe('comparePortfolioHistoryEntries', () => {
  it('reports before/after/delta/changed for every numeric metric', () => {
    const before = entry({ healthFactor: 4, collateral: { quantity: 2, valueUsd: 100000 } });
    const after = entry({ healthFactor: 3, collateral: { quantity: 2, valueUsd: 90000 } });

    const comparison = comparePortfolioHistoryEntries(before, after);

    expect(comparison.healthFactor).toEqual({ before: 4, after: 3, delta: -1, changed: true });
    expect(comparison.collateralValueUsd).toEqual({
      before: 100000,
      after: 90000,
      delta: -10000,
      changed: true,
    });
  });

  it('reports changed: false and a zero delta when a metric is unchanged', () => {
    const same = entry();
    const comparison = comparePortfolioHistoryEntries(same, same);
    expect(comparison.healthFactor).toEqual({ before: 4, after: 4, delta: 0, changed: false });
    expect(comparison.leverage.changed).toBe(false);
  });

  it('does not name or imply causation — output is a plain before/after/delta triple', () => {
    const comparison = comparePortfolioHistoryEntries(
      entry({ healthFactor: 4 }),
      entry({ healthFactor: 3 }),
    );
    // Structural assertion: only these four keys exist per metric, no
    // "reason"/"cause"/"trigger" field is fabricated.
    expect(Object.keys(comparison.healthFactor).sort()).toEqual([
      'after',
      'before',
      'changed',
      'delta',
    ]);
  });

  it('healthFactor null <-> finite renders as changed with a null delta (no numeric subtraction against Infinity)', () => {
    const comparison = comparePortfolioHistoryEntries(
      entry({ healthFactor: 4 }),
      entry({ healthFactor: null }),
    );
    expect(comparison.healthFactor).toEqual({ before: 4, after: null, delta: null, changed: true });
  });

  it('liquidationPriceUsd null <-> non-null renders as changed with a null delta', () => {
    const comparison = comparePortfolioHistoryEntries(
      entry({ liquidationPriceUsd: null }),
      entry({ liquidationPriceUsd: 12500 }),
    );
    expect(comparison.liquidationPriceUsd).toEqual({
      before: null,
      after: 12500,
      delta: null,
      changed: true,
    });
  });

  it('V1.1 Batch 4: a full-exit transition (leveraged -> zero collateral/zero debt) produces a deterministic, NaN-free comparison across every metric at once', () => {
    const before = entry();
    const after = entry({
      collateral: { quantity: 0, valueUsd: 0 },
      debt: { asset: 'USDC', quantity: 0, valueUsd: 0 },
      healthFactor: null,
      liquidationPriceUsd: null,
      loanToValue: 0,
      leverage: 0,
      annualizedInterestCost: 0,
    });

    const comparison = comparePortfolioHistoryEntries(before, after);

    expect(comparison.healthFactor).toEqual({ before: 4, after: null, delta: null, changed: true });
    expect(comparison.leverage).toEqual({ before: 1.25, after: 0, delta: -1.25, changed: true });
    expect(comparison.loanToValue).toEqual({ before: 0.2, after: 0, delta: -0.2, changed: true });
    expect(comparison.liquidationPriceUsd).toEqual({
      before: 12500,
      after: null,
      delta: null,
      changed: true,
    });
    expect(comparison.collateralValueUsd).toEqual({
      before: 100000,
      after: 0,
      delta: -100000,
      changed: true,
    });
    expect(comparison.debtValueUsd).toEqual({
      before: 20000,
      after: 0,
      delta: -20000,
      changed: true,
    });
    for (const metric of Object.values(comparison)) {
      expect(Number.isNaN(metric.delta)).toBe(false);
    }
  });

  it('borrowApr undefined <-> defined renders as changed with an undefined delta', () => {
    const comparison = comparePortfolioHistoryEntries(
      entry({ borrowApr: undefined }),
      entry({ borrowApr: 0.05 }),
    );
    expect(comparison.borrowApr).toEqual({
      before: undefined,
      after: 0.05,
      delta: undefined,
      changed: true,
    });
  });
});
