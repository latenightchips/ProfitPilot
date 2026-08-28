import { describe, expect, it } from 'vitest';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence/types';
import { isMaterialPortfolioHistoryChange } from '@/services/portfolioHistory/isMaterialPortfolioHistoryChange';

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

describe('isMaterialPortfolioHistoryChange', () => {
  it('is always material when there is no previous entry', () => {
    expect(isMaterialPortfolioHistoryChange(null, entry())).toBe(true);
  });

  it('is not material when nothing differs at all', () => {
    expect(isMaterialPortfolioHistoryChange(entry(), entry())).toBe(false);
  });

  it('ignores float noise below every threshold', () => {
    const previous = entry();
    const next = entry({
      healthFactor: 4.001,
      marketPriceUsd: 50001,
      loanToValue: 0.2001,
      leverage: 1.2501,
      annualizedInterestCost: 1001,
    });
    expect(isMaterialPortfolioHistoryChange(previous, next)).toBe(false);
  });

  it.each([
    ['protocol version switch', { protocolVersion: 'v4' as const }],
    ['debt asset switch', { debt: { asset: 'DAI', quantity: 20000, valueUsd: 20000 } }],
    ['collateral quantity change', { collateral: { quantity: 2.5, valueUsd: 125000 } }],
    ['debt quantity change', { debt: { asset: 'USDC', quantity: 21000, valueUsd: 21000 } }],
  ])('always treats a structural change as material: %s', (_label, override) => {
    expect(isMaterialPortfolioHistoryChange(entry(), entry(override))).toBe(true);
  });

  it('treats liquidationPriceUsd null <-> non-null as always material', () => {
    expect(isMaterialPortfolioHistoryChange(entry(), entry({ liquidationPriceUsd: null }))).toBe(
      true,
    );
    expect(isMaterialPortfolioHistoryChange(entry({ liquidationPriceUsd: null }), entry())).toBe(
      true,
    );
  });

  it('treats healthFactor null <-> finite (Infinity <-> real HF) as always material', () => {
    expect(isMaterialPortfolioHistoryChange(entry(), entry({ healthFactor: null }))).toBe(true);
    expect(isMaterialPortfolioHistoryChange(entry({ healthFactor: null }), entry())).toBe(true);
  });

  it('is not material when healthFactor stays null on both sides', () => {
    const previous = entry({ healthFactor: null });
    const next = entry({ healthFactor: null });
    expect(isMaterialPortfolioHistoryChange(previous, next)).toBe(false);
  });

  it('is material once healthFactor moves beyond the absolute threshold', () => {
    expect(
      isMaterialPortfolioHistoryChange(entry({ healthFactor: 4 }), entry({ healthFactor: 4.02 })),
    ).toBe(true);
  });

  it('is material once market price moves beyond the relative threshold', () => {
    expect(
      isMaterialPortfolioHistoryChange(
        entry({ marketPriceUsd: 50000 }),
        entry({ marketPriceUsd: 50300 }),
      ),
    ).toBe(true);
  });

  it('treats an APR becoming unavailable (or newly available) as always material', () => {
    expect(
      isMaterialPortfolioHistoryChange(entry({ borrowApr: 0.05 }), entry({ borrowApr: undefined })),
    ).toBe(true);
    expect(
      isMaterialPortfolioHistoryChange(entry({ borrowApr: undefined }), entry({ borrowApr: 0.05 })),
    ).toBe(true);
  });

  it('is material once borrowApr moves beyond its absolute threshold', () => {
    expect(
      isMaterialPortfolioHistoryChange(entry({ borrowApr: 0.05 }), entry({ borrowApr: 0.052 })),
    ).toBe(true);
  });

  it('is material once annualizedInterestCost moves beyond its relative threshold', () => {
    expect(
      isMaterialPortfolioHistoryChange(
        entry({ annualizedInterestCost: 1000 }),
        entry({ annualizedInterestCost: 1050 }),
      ),
    ).toBe(true);
  });
});
