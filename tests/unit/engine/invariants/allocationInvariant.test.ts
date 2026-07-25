import { describe, expect, it } from 'vitest';

import { calculateCollateralValue } from '@/engine/portfolio/calculateCollateralValue';
import { calculatePortfolioValue } from '@/engine/portfolio/calculatePortfolioValue';
import type { CollateralPosition, MarketPrices } from '@/engine/shared/types';
import { checkAllocationInvariant } from '@/engine/validation/invariants';

/**
 * 06_TASKS.md M2-027 invariant: "Allocation percentages total
 * approximately 100%." Under the approved single-asset scope
 * (01_PRD.md REQ-003), the single BTC position is always 100% of
 * collateral value — checked structurally rather than assumed.
 */
describe('Engine invariant: Allocation percentages total 100% (M2-027)', () => {
  const scenarios: { collateral: CollateralPosition; market: MarketPrices }[] = [
    { collateral: { asset: 'BTC', quantity: 2 }, market: { btcPriceUsd: 60000 } },
    { collateral: { asset: 'BTC', quantity: 0.1 }, market: { btcPriceUsd: 90000 } },
    { collateral: { asset: 'BTC', quantity: 0 }, market: { btcPriceUsd: 60000 } },
  ];

  it.each(scenarios)('holds for %o', ({ collateral, market }) => {
    const collateralValueResult = calculateCollateralValue(collateral, market);
    const portfolioValueResult = calculatePortfolioValue(collateral, market);

    expect(collateralValueResult.ok && portfolioValueResult.ok).toBe(true);
    if (!collateralValueResult.ok || !portfolioValueResult.ok) return;

    expect(checkAllocationInvariant(collateralValueResult.value, portfolioValueResult.value)).toBe(
      true,
    );
  });
});
