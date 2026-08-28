import { describe, expect, it } from 'vitest';

import { calculateEffectiveLeverage } from '@/engine/portfolio/calculateEffectiveLeverage';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

describe('calculateEffectiveLeverage (F-011)', () => {
  it('matches the documented example: exposure $180,000 / net worth $100,000 = 1.80x', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 3 },
      debt: { asset: 'USDC', balance: 80000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const result = calculateEffectiveLeverage(portfolio);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(1.8);
      expect(result.metadata.formulaId).toBe('F-011');
    }
  });

  it('matches Scenario B from the Leverage & Loop unit test examples: exposure $220,000 / net worth $100,000 = 2.20x', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 2.2 },
      debt: { asset: 'USDC', balance: 120000 },
      market: { btcPriceUsd: 100000 },
      protocol,
    };
    const result = calculateEffectiveLeverage(portfolio);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(2.2);
  });

  it('fails with a structured error when net worth is zero', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 60000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const result = calculateEffectiveLeverage(portfolio);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DIVISION_BY_ZERO');
  });

  it('propagates a failure from an invalid collateral quantity', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: -1 },
      debt: { asset: 'USDC', balance: 1000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const result = calculateEffectiveLeverage(portfolio);
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid debt balance', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: -1 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const result = calculateEffectiveLeverage(portfolio);
    expect(result.ok).toBe(false);
  });

  it('V1.1 Batch 4: returns 0 for a fully exited, zero-collateral/zero-debt portfolio (0/0, not a division-by-zero failure)', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 0 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const result = calculateEffectiveLeverage(portfolio);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0);
      expect(result.warnings.some((w) => w.code === 'ZERO_EXPOSURE_ZERO_NET_WORTH')).toBe(true);
    }
  });

  it('warns when net worth is negative', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 70000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const result = calculateEffectiveLeverage(portfolio);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.some((w) => w.code === 'NEGATIVE_EQUITY')).toBe(true);
    }
  });
});
