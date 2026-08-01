import { describe, expect, it } from 'vitest';

import { buildFinalLoopPortfolio } from '@/services/loop/finalPortfolio';
import type { LoopStrategySettings } from '@/services/loop/strategy';
import { planLoopStrategy } from '@/services/loop/strategy';
import type { ApplicationPortfolio } from '@/services/portfolio/models';

function healthyPortfolio(): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  };
}

function healthySettings(): LoopStrategySettings {
  return { targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 };
}

describe('buildFinalLoopPortfolio (Milestone 7 Batch 3)', () => {
  it('carries the strategy final collateral/debt and the starting market/protocol unchanged', () => {
    const portfolio = healthyPortfolio();
    const result = planLoopStrategy(portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    expect(finalPortfolio.collateral).toEqual(result.data.strategy.finalCollateral);
    expect(finalPortfolio.debt).toEqual({
      asset: portfolio.debt.asset,
      balance: result.data.strategy.finalDebt,
    });
    expect(finalPortfolio.market).toBe(portfolio.market);
    expect(finalPortfolio.protocol).toBe(portfolio.protocol);
  });
});
