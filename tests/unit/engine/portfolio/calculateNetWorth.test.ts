import { describe, expect, it } from 'vitest';

import { calculateNetWorth } from '@/engine/portfolio/calculateNetWorth';

describe('calculateNetWorth (F-004)', () => {
  it('matches the documented example: portfolio $120,000, debt $30,000 = net worth $90,000', () => {
    const result = calculateNetWorth({
      collateral: { asset: 'BTC', quantity: 4 },
      debt: { asset: 'USDC', balance: 30000 },
      market: { btcPriceUsd: 30000 },
      protocol: {
        maxLoanToValue: 0.7,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(90000);
      expect(result.metadata.formulaId).toBe('F-004');
      expect(result.warnings).toEqual([]);
    }
  });

  it('allows negative equity and attaches a warning, per the documented edge case', () => {
    const result = calculateNetWorth({
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 50000 },
      market: { btcPriceUsd: 30000 },
      protocol: {
        maxLoanToValue: 0.7,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(-20000);
      expect(result.warnings.some((w) => w.code === 'NEGATIVE_EQUITY')).toBe(true);
    }
  });

  it('propagates a failure from an invalid debt balance', () => {
    const result = calculateNetWorth({
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: -1 },
      market: { btcPriceUsd: 30000 },
      protocol: {
        maxLoanToValue: 0.7,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid collateral quantity', () => {
    const result = calculateNetWorth({
      collateral: { asset: 'BTC', quantity: -1 },
      debt: { asset: 'USDC', balance: 1000 },
      market: { btcPriceUsd: 30000 },
      protocol: {
        maxLoanToValue: 0.7,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    });
    expect(result.ok).toBe(false);
  });
});
