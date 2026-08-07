import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { calculateHealthFactor } from '@/engine/health/calculateHealthFactor';
import { calculateProratedInterest } from '@/engine/interest/calculateProratedInterest';
import { calculateCollateralValue } from '@/engine/portfolio/calculateCollateralValue';
import { calculateLoanToValue } from '@/engine/portfolio/calculateLoanToValue';

/**
 * Property-Based Formula Tests — 06_TASKS.md M9-010 ("Implement
 * Property-Based Formula Tests"). Dependencies: M9-009. Description:
 * "Create generated tests for suitable mathematical properties." DoD:
 * "Property tests cover the most important monotonic and invariant
 * behaviors."
 *
 * Uses `fast-check` (added as a new devDependency this batch, per
 * `04_BUILD_GUIDE.md`'s own recommendation and this task's own
 * dependency on it not already being installed) rather than hand-written
 * example tables — each property below runs against hundreds of
 * generated inputs per test, not a handful of fixed scenarios.
 *
 * M9-010's own "Examples" list names 5 properties. 4 are implemented
 * below directly against already-implemented Formula IDs. The 5th —
 * "Removing fees must not worsen net proceeds" — is **not applicable**:
 * this Engine computes no transaction fees at all (no Formula ID or
 * equation for swap fees, slippage, or gas estimation exists anywhere in
 * `02_Formulas.md` — `calculateExitPosition`'s own `unavailableCosts`
 * field documents this explicitly, see `PROJECT_STATUS.md` Conflict #8).
 * There is no fee-bearing calculation in this codebase to write a
 * monotonicity property against; fabricating one would mean inventing a
 * fee model this Engine does not have, contradicting this whole
 * engagement's "never invent formulas" discipline.
 */
describe('Property-based formula tests (M9-010)', () => {
  const finiteNonNegative = (max: number) =>
    fc.double({ min: 0, max, noNaN: true, noDefaultInfinity: true });

  const positivePrice = fc.double({
    min: 0.01,
    max: 1_000_000,
    noNaN: true,
    noDefaultInfinity: true,
  });

  const threshold = fc.double({ min: 0.01, max: 1, noNaN: true, noDefaultInfinity: true });

  it('Increasing debt must not improve Health Factor when other values are fixed', () => {
    fc.assert(
      fc.property(
        finiteNonNegative(10_000_000),
        threshold,
        finiteNonNegative(5_000_000),
        finiteNonNegative(5_000_000),
        (collateralValue, liquidationThreshold, debtA, debtDelta) => {
          const lowerDebt = debtA;
          const higherDebt = debtA + debtDelta;

          const hfLower = calculateHealthFactor(collateralValue, liquidationThreshold, lowerDebt);
          const hfHigher = calculateHealthFactor(collateralValue, liquidationThreshold, higherDebt);

          expect(hfLower.ok).toBe(true);
          expect(hfHigher.ok).toBe(true);
          if (!hfLower.ok || !hfHigher.ok) return;

          // Both Infinity (zero debt on both sides) is consistent, not a violation.
          if (hfLower.value === Infinity && hfHigher.value === Infinity) return;

          expect(hfHigher.value).toBeLessThanOrEqual(hfLower.value);
        },
      ),
    );
  });

  it('Adding eligible collateral must not reduce Health Factor', () => {
    fc.assert(
      fc.property(
        finiteNonNegative(1000),
        positivePrice,
        finiteNonNegative(1000),
        threshold,
        finiteNonNegative(5_000_000),
        (quantityBefore, price, addedQuantity, liquidationThreshold, debtValue) => {
          const valueBeforeResult = calculateCollateralValue(
            { asset: 'BTC', quantity: quantityBefore },
            { btcPriceUsd: price },
          );
          const valueAfterResult = calculateCollateralValue(
            { asset: 'BTC', quantity: quantityBefore + addedQuantity },
            { btcPriceUsd: price },
          );
          expect(valueBeforeResult.ok).toBe(true);
          expect(valueAfterResult.ok).toBe(true);
          if (!valueBeforeResult.ok || !valueAfterResult.ok) return;

          const hfBefore = calculateHealthFactor(
            valueBeforeResult.value,
            liquidationThreshold,
            debtValue,
          );
          const hfAfter = calculateHealthFactor(
            valueAfterResult.value,
            liquidationThreshold,
            debtValue,
          );
          expect(hfBefore.ok).toBe(true);
          expect(hfAfter.ok).toBe(true);
          if (!hfBefore.ok || !hfAfter.ok) return;

          if (hfBefore.value === Infinity) return; // already unbounded; nothing to improve

          expect(hfAfter.value).toBeGreaterThanOrEqual(hfBefore.value);
        },
      ),
    );
  });

  it('Repaying debt must not increase LTV', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 5_000_000, noNaN: true, noDefaultInfinity: true }),
        finiteNonNegative(5_000_000),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        (collateralValue, debtValue, repaymentFraction) => {
          const repayment = debtValue * repaymentFraction;
          const debtAfter = debtValue - repayment;

          const ltvBeforeResult = calculateLoanToValue(debtValue, collateralValue);
          const ltvAfterResult = calculateLoanToValue(debtAfter, collateralValue);
          expect(ltvBeforeResult.ok).toBe(true);
          expect(ltvAfterResult.ok).toBe(true);
          if (!ltvBeforeResult.ok || !ltvAfterResult.ok) return;

          expect(ltvAfterResult.value).toBeLessThanOrEqual(ltvBeforeResult.value);
        },
      ),
    );
  });

  it('Zero-duration interest projection must preserve starting debt', () => {
    fc.assert(
      fc.property(finiteNonNegative(10_000_000), finiteNonNegative(10), (debtValue, apr) => {
        const result = calculateProratedInterest(debtValue, apr, 0);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.value).toBe(0);
        expect(debtValue + result.value).toBe(debtValue);
      }),
    );
  });
});
