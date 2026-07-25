import { describe, expect, it } from 'vitest';

import { calculateCollateralValue } from '@/engine/portfolio/calculateCollateralValue';
import { calculateDebtValue } from '@/engine/portfolio/calculateDebtValue';
import { calculateNetWorth } from '@/engine/portfolio/calculateNetWorth';
import type { PortfolioInput } from '@/engine/shared/types';
import { checkNetWorthInvariant } from '@/engine/validation/invariants';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

/**
 * 06_TASKS.md M2-027 invariant: "Net value equals collateral minus debt."
 * F-004's own equation, checked across several portfolios rather than
 * trusted from a single unit test.
 */
describe('Engine invariant: Net value equals collateral minus debt (M2-027)', () => {
  const scenarios: PortfolioInput[] = [
    {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 30000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    },
    {
      collateral: { asset: 'BTC', quantity: 0.5 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 90000 },
      protocol,
    },
    {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 70000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    },
  ];

  it.each(scenarios)('holds for collateral %o', (portfolio) => {
    const collateralValueResult = calculateCollateralValue(portfolio.collateral, portfolio.market);
    const debtValueResult = calculateDebtValue(portfolio.debt);
    const netWorthResult = calculateNetWorth(portfolio);

    expect(collateralValueResult.ok && debtValueResult.ok && netWorthResult.ok).toBe(true);
    if (!collateralValueResult.ok || !debtValueResult.ok || !netWorthResult.ok) return;

    expect(
      checkNetWorthInvariant(
        collateralValueResult.value,
        debtValueResult.value,
        netWorthResult.value,
      ),
    ).toBe(true);
  });
});
