import { describe, expect, it } from 'vitest';

import { calculateCollateralValue } from '@/engine/portfolio/calculateCollateralValue';
import type { CollateralPosition, MarketPrices } from '@/engine/shared/types';
import { checkCollateralAdditionInvariant } from '@/engine/validation/invariants';

/**
 * 06_TASKS.md M9-009 invariant: "Collateral addition increases adjusted
 * collateral consistently." F-002's own equation (Collateral Value =
 * Quantity × Price), checked as a before/after invariant across several
 * scenarios — there is no dedicated "add collateral" Engine function
 * (Version 1 applies this as a direct quantity change, per
 * `docs/06_TASKS.md` M4-007's "Collateral Position Management" form), so
 * this exercises F-002 directly on before/after quantities, the same
 * composition every calling Store action already performs.
 */
describe('Engine invariant: Collateral addition increases adjusted collateral consistently (M9-009)', () => {
  const market: MarketPrices = { btcPriceUsd: 60000 };

  const scenarios: { before: CollateralPosition; addedQuantity: number }[] = [
    { before: { asset: 'BTC', quantity: 1 }, addedQuantity: 0.5 },
    { before: { asset: 'BTC', quantity: 0 }, addedQuantity: 2 },
    { before: { asset: 'BTC', quantity: 3.33333333 }, addedQuantity: 0.00000001 },
  ];

  it.each(scenarios)(
    'holds when adding $addedQuantity BTC to a starting quantity of $before.quantity',
    ({ before, addedQuantity }) => {
      const after: CollateralPosition = {
        asset: before.asset,
        quantity: before.quantity + addedQuantity,
      };

      const beforeValueResult = calculateCollateralValue(before, market);
      const afterValueResult = calculateCollateralValue(after, market);
      const addedValueResult = calculateCollateralValue(
        { asset: before.asset, quantity: addedQuantity },
        market,
      );

      expect(beforeValueResult.ok && afterValueResult.ok && addedValueResult.ok).toBe(true);
      if (!beforeValueResult.ok || !afterValueResult.ok || !addedValueResult.ok) return;

      expect(
        checkCollateralAdditionInvariant(
          beforeValueResult.value,
          afterValueResult.value,
          addedValueResult.value,
        ),
      ).toBe(true);
    },
  );
});
