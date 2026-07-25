import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateLoanToValue } from '../portfolio/calculateLoanToValue';
import { toDecimal, toOutputNumber } from '../shared/decimal';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';
import type {
  CollateralPosition,
  DebtPosition,
  MarketPrices,
  PercentageDecimal,
  ProtocolParameters,
} from '../shared/types';
import { validatePercentage, validateProtocolParameters } from '../validation/validate';
import { calculateAvailableBorrow } from './calculateBorrowCapacity';
import { calculateBtcPurchasedPerLoop } from './calculateBtcPurchasedPerLoop';
import { calculateLoopCapital } from './calculateLoopCapital';

const FORMULA_ID = 'F-014';
const FORMULA_VERSION = '1.0';

export interface LoopStepInput {
  collateral: CollateralPosition;
  debt: DebtPosition;
  market: MarketPrices;
  protocol: ProtocolParameters;
  /**
   * Fraction (0-1) of this step's available borrow capacity (F-013) to
   * actually draw. 06_TASKS.md M2-016 documents this as the multi-step
   * strategy's "Target borrow percentage" input; a single step accepts it
   * directly rather than always maxing out capacity, since 02_Formulas.md
   * does not require a loop step to borrow 100% of what is available.
   */
  borrowPercentage: PercentageDecimal;
}

export interface LoopStepResult {
  /** Available Borrow — F-013. */
  availableBorrow: number;
  /** Actual amount borrowed this step (availableBorrow x borrowPercentage). */
  borrowedAmount: number;
  /** Loop Capital — F-014 (identity over borrowedAmount). */
  loopCapital: number;
  /** BTC Purchased Per Loop — F-015. */
  btcPurchased: number;
  collateralAfter: CollateralPosition;
  /** Collateral Value — F-002, recomputed on collateralAfter. */
  collateralValueAfter: number;
  debtAfter: number;
  /** Loan-to-Value — F-020, recomputed on the post-step position. */
  newLoanToValue: number;
  /** Health Factor — F-022, recomputed on the post-step position. */
  newHealthFactor: number;
}

/**
 * Loop Step — 06_TASKS.md M2-015 ("Implement Loop Step Mathematics").
 *
 * Composes one borrow-and-resupply loop step from already-implemented
 * Formula IDs, per the 02_Formulas.md LOOP DEPENDENCY GRAPH (Borrow
 * Capacity -> Borrow -> BTC Purchase -> Collateral -> Exposure -> ...):
 *   - Available Borrow (F-013)
 *   - Loop Capital (F-014) over the amount actually drawn
 *   - BTC Purchased Per Loop (F-015)
 *   - Collateral Value (F-002), recomputed on the resupplied position
 *   - Loan-to-Value (F-020) and Health Factor (F-022), recomputed on the
 *     post-step position
 * "Collateral after resupply" and "Debt after borrowing" (06_TASKS.md
 * M2-015) are plain additions with no dedicated Formula ID in
 * 02_Formulas.md, so they are computed directly rather than routed through
 * a formula-tagged function.
 *
 * Tagged F-014 (Loop Capital) as its primary Formula ID: F-014's purpose,
 * "Capital deployed in one loop", is the closest documented description of
 * what this whole function computes. Every other Formula ID it reuses is
 * documented per-field above and covered by that formula's own tests.
 */
export function calculateLoopStep(input: LoopStepInput): FormulaResult<LoopStepResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...input },
  };

  const protocolValidation = validateProtocolParameters(input.protocol);
  if (!protocolValidation.ok) return createFailure(protocolValidation.error, options);

  const borrowPercentage = validatePercentage(input.borrowPercentage, 'borrowPercentage');
  if (!borrowPercentage.ok) return createFailure(borrowPercentage.error, options);

  const collateralValueResult = calculateCollateralValue(input.collateral, input.market);
  if (!collateralValueResult.ok) return createFailure(collateralValueResult.error, options);

  const availableBorrowResult = calculateAvailableBorrow(
    collateralValueResult.value,
    input.protocol.maxLoanToValue,
    input.debt.balance,
  );
  if (!availableBorrowResult.ok) return createFailure(availableBorrowResult.error, options);

  const warnings: FormulaWarning[] = [
    ...collateralValueResult.warnings,
    ...availableBorrowResult.warnings,
  ];

  const availableBorrow = toDecimal(availableBorrowResult.value);
  const borrowedAmount = availableBorrow.isNegative()
    ? toDecimal(0)
    : availableBorrow.times(borrowPercentage.value);
  if (availableBorrow.isNegative()) {
    warnings.push({
      code: 'NO_BORROW_CAPACITY',
      message: 'Current debt already exceeds borrow capacity; this step borrows nothing.',
    });
  }

  const loopCapitalResult = calculateLoopCapital(toOutputNumber(borrowedAmount));
  if (!loopCapitalResult.ok) return createFailure(loopCapitalResult.error, options);

  const btcPurchasedResult = calculateBtcPurchasedPerLoop(
    toOutputNumber(borrowedAmount),
    input.market.btcPriceUsd,
  );
  if (!btcPurchasedResult.ok) return createFailure(btcPurchasedResult.error, options);

  const collateralAfter: CollateralPosition = {
    asset: input.collateral.asset,
    quantity: toOutputNumber(toDecimal(input.collateral.quantity).plus(btcPurchasedResult.value)),
  };

  // collateralAfter.quantity is (validated non-negative) + (clamped non-negative
  // btcPurchased) on an already-validated market price, so this branch is
  // mathematically unreachable given valid inputs; kept for defense in depth.
  const collateralValueAfterResult = calculateCollateralValue(collateralAfter, input.market);
  if (!collateralValueAfterResult.ok)
    return createFailure(collateralValueAfterResult.error, options);

  const debtAfter = toOutputNumber(toDecimal(input.debt.balance).plus(borrowedAmount));

  const newLoanToValueResult = calculateLoanToValue(debtAfter, collateralValueAfterResult.value);
  if (!newLoanToValueResult.ok) return createFailure(newLoanToValueResult.error, options);

  const newHealthFactorResult = calculateHealthFactor(
    collateralValueAfterResult.value,
    input.protocol.liquidationThreshold,
    debtAfter,
  );
  if (!newHealthFactorResult.ok) return createFailure(newHealthFactorResult.error, options);

  warnings.push(
    ...btcPurchasedResult.warnings,
    ...collateralValueAfterResult.warnings,
    ...newLoanToValueResult.warnings,
    ...newHealthFactorResult.warnings,
  );

  return createSuccess(
    {
      availableBorrow: availableBorrowResult.value,
      borrowedAmount: toOutputNumber(borrowedAmount),
      loopCapital: loopCapitalResult.value,
      btcPurchased: btcPurchasedResult.value,
      collateralAfter,
      collateralValueAfter: collateralValueAfterResult.value,
      debtAfter,
      newLoanToValue: newLoanToValueResult.value,
      newHealthFactor: newHealthFactorResult.value,
    },
    options,
    warnings,
  );
}
