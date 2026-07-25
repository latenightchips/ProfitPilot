import { toDecimal } from '../shared/decimal';

/**
 * Engine Invariants — 06_TASKS.md M2-027 ("Implement Engine Invariants").
 * "Add automated checks for relationships that must always remain true."
 *
 * These are plain boolean predicates, not `FormulaResult`-wrapped
 * calculations — the same treatment `engine/validation/validate.ts`
 * (M2-005) gives its own input-validation helpers, since an invariant
 * check produces a pass/fail judgment about an already-computed
 * relationship, not a new derived value with its own Formula ID. M2-027
 * introduces no new Formula ID; it composes already-implemented formulas'
 * outputs and checks the relationships `06_TASKS.md`'s own "Examples"
 * list names between them.
 *
 * A small numeric tolerance (default `1e-9`) absorbs floating-point/
 * Decimal-rounding noise from `toOutputNumber` boundary conversions —
 * these are exact mathematical identities, not measurements, so the
 * tolerance is deliberately tight.
 */
const DEFAULT_TOLERANCE = '1e-9';

function within(actual: number, expected: number, tolerance: string): boolean {
  return toDecimal(actual).minus(expected).abs().lessThanOrEqualTo(tolerance);
}

/**
 * Invariant: "Net value equals collateral minus debt" — F-004's own
 * equation (Net Worth = Portfolio Value − Debt Value; under the approved
 * single-asset scope, Portfolio Value ≡ Collateral Value, F-001's own
 * documented assumption).
 */
export function checkNetWorthInvariant(
  collateralValue: number,
  debtValue: number,
  netWorth: number,
  tolerance: string = DEFAULT_TOLERANCE,
): boolean {
  return within(netWorth, collateralValue - debtValue, tolerance);
}

/**
 * Invariant: "Allocation percentages total approximately 100%." Under the
 * approved single-asset scope (01_PRD.md REQ-003), the single BTC
 * collateral position is always 100% of allocated collateral value — this
 * checks that identity holds structurally rather than assuming it.
 */
export function checkAllocationInvariant(
  collateralValue: number,
  portfolioValue: number,
  tolerance: string = DEFAULT_TOLERANCE,
): boolean {
  if (portfolioValue === 0) return collateralValue === 0;
  return within(collateralValue / portfolioValue, 1, tolerance);
}

/**
 * Invariant: "Target Health Factor results reproduce the target." The
 * same recomputation-and-compare pattern already used inline by
 * `calculateAdditionalBorrow` (F-027) and
 * `calculateAdditionalCollateralRecommendation` (F-063), extracted here so
 * it can be asserted as an explicit, named, cross-function invariant.
 */
export function checkTargetHealthFactorInvariant(
  resultingHealthFactor: number,
  targetHealthFactor: number,
  tolerance: string = DEFAULT_TOLERANCE,
): boolean {
  return within(resultingHealthFactor, targetHealthFactor, tolerance);
}

/**
 * Invariant: "Loop results reconcile with step totals." Final collateral
 * quantity must equal the starting quantity plus every step's BTC
 * purchased; final debt must equal the starting debt plus every step's
 * borrowed amount.
 */
export function checkLoopReconciliationInvariant(
  initialCollateralQuantity: number,
  finalCollateralQuantity: number,
  stepBtcPurchased: number[],
  initialDebt: number,
  finalDebt: number,
  stepBorrowedAmounts: number[],
  tolerance: string = DEFAULT_TOLERANCE,
): boolean {
  const expectedQuantity = stepBtcPurchased.reduce(
    (sum, value) => sum.plus(value),
    toDecimal(initialCollateralQuantity),
  );
  const expectedDebt = stepBorrowedAmounts.reduce(
    (sum, value) => sum.plus(value),
    toDecimal(initialDebt),
  );
  return (
    within(finalCollateralQuantity, expectedQuantity.toNumber(), tolerance) &&
    within(finalDebt, expectedDebt.toNumber(), tolerance)
  );
}

/**
 * Invariant: "Full debt repayment produces zero debt" — the `targetDebt:
 * 0` case of `calculateExitPosition` (M2-023) must leave exactly zero
 * remaining debt, not an approximately-zero residual.
 */
export function checkFullRepaymentInvariant(remainingDebt: number): boolean {
  return remainingDebt === 0;
}
