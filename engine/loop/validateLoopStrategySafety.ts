import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateLoanToValue } from '../portfolio/calculateLoanToValue';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import { validateProtocolParameters } from '../validation/validate';
import { calculateAvailableBorrow } from './calculateBorrowCapacity';
import {
  calculateLoopStrategy,
  type LoopStrategyInput,
  type LoopStrategyResult,
} from './calculateLoopStrategy';

const FORMULA_ID = 'F-018';
const FORMULA_VERSION = '1.0';

/**
 * The documented Health Factor safety boundary — 02_Formulas.md F-022
 * ("Above 1.0 Safe / Near 1.0 Danger / Below 1.0 Liquidation"). Not an
 * invented threshold: it is the equation's own stated liquidation
 * boundary, reused here rather than duplicated as a magic number.
 */
const LIQUIDATION_HEALTH_FACTOR = 1;

export type LoopSafetyCheck =
  | 'VALID_PROTOCOL_PARAMETERS'
  | 'LIQUIDATION_PROXIMITY'
  | 'MINIMUM_HEALTH_FACTOR'
  | 'BORROWING_CAPACITY'
  | 'MAXIMUM_LTV'
  | 'MAXIMUM_LOOP_COUNT';

export interface LoopSafetyFinding {
  check: LoopSafetyCheck;
  severity: 'error' | 'warning';
  message: string;
}

export interface LoopSafetyValidationResult {
  viable: boolean;
  findings: LoopSafetyFinding[];
  /** null when an error finding prevented the strategy from being computed at all. */
  strategy: LoopStrategyResult | null;
}

/**
 * Loop Safety Validation — 06_TASKS.md M2-018 ("Implement Loop Safety
 * Validation").
 *
 * Unlike M2-015/016/017, 06_TASKS.md's M2-018 task text names no Formula
 * ID, and 02_Formulas.md defines no "Loop Safety Validation" formula
 * anywhere. This function's core computation is calculateLoopStrategy
 * (F-018), so F-018 is reused as its tag rather than left blank — but the
 * safety gate itself is task-level orchestration, not a new formula.
 *
 * 06_TASKS.md M2-018 lists 7 checks. 6 are implemented, each grounded in an
 * already-documented formula or definition:
 *   - "Valid protocol parameters": validateProtocolParameters (reused).
 *   - "Liquidation proximity": the *starting* position's Health Factor
 *     (F-022) must be above 1.0 — F-022's own documented boundary
 *     ("Below 1.0 Liquidation"), not an invented threshold.
 *   - "Minimum Health Factor": the *configured* minHealthFactor floor must
 *     itself be above 1.0, for the same documented reason — a configured
 *     floor at or below the liquidation boundary can never be safe.
 *   - "Borrowing capacity": Available Borrow (F-013) on the starting
 *     position; zero or negative means no loop can execute (a warning, not
 *     an error — it is not unsafe, merely non-actionable).
 *   - "Maximum LTV" and "Maximum loop count": re-verified against the
 *     computed strategy's actual outcome (Loan-to-Value F-020, and
 *     steps.length vs. the configured maxLoops) as a defense-in-depth
 *     check; calculateLoopStrategy's own step logic already guarantees
 *     both structurally, so these are expected to always pass for valid
 *     inputs.
 *
 * "Excessive cost" is NOT implemented: 02_Formulas.md's only "excessive
 * cost" rule (F-065 "Interest Warning": Annual Interest > Expected Annual
 * Portfolio Growth) requires an "Expected Annual Portfolio Growth" figure
 * that has no formula or definition anywhere in 02_Formulas.md, and F-065
 * itself is not assigned to any 06_TASKS.md task (an unassigned Formula ID,
 * same pattern as F-005-F-008 and F-034-F-039 — see PROJECT_STATUS.md).
 * Implementing it would mean inventing an "expected growth" assumption,
 * which is out of scope.
 *
 * Per the M2-018 DoD ("unsafe strategies return explicit errors or
 * warnings rather than appearing successful"): a well-formed but unsafe
 * strategy is still an `ok: true` FormulaResult — `viable: false` plus the
 * `error`-severity findings that explain why IS the "explicit error",
 * carried as data rather than as a thrown/failed result. `ok: false` is
 * reserved for malformed inputs (e.g. a negative collateral quantity),
 * consistent with every other Engine function.
 */
export function validateLoopStrategySafety(
  input: LoopStrategyInput,
): FormulaResult<LoopSafetyValidationResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...input },
  };

  const findings: LoopSafetyFinding[] = [];

  const protocolValidation = validateProtocolParameters(input.protocol);
  if (!protocolValidation.ok) {
    findings.push({
      check: 'VALID_PROTOCOL_PARAMETERS',
      severity: 'error',
      message: protocolValidation.error.message,
    });
    return createSuccess({ viable: false, findings, strategy: null }, options);
  }

  const collateralValueResult = calculateCollateralValue(input.collateral, input.market);
  if (!collateralValueResult.ok) return createFailure(collateralValueResult.error, options);

  const startingHealthFactorResult = calculateHealthFactor(
    collateralValueResult.value,
    input.protocol.liquidationThreshold,
    input.debt.balance,
  );
  if (!startingHealthFactorResult.ok)
    return createFailure(startingHealthFactorResult.error, options);

  if (startingHealthFactorResult.value <= LIQUIDATION_HEALTH_FACTOR) {
    findings.push({
      check: 'LIQUIDATION_PROXIMITY',
      severity: 'error',
      message: 'The starting position is already at or below Health Factor 1.0 (liquidation).',
    });
  }

  if (input.minHealthFactor <= LIQUIDATION_HEALTH_FACTOR) {
    findings.push({
      check: 'MINIMUM_HEALTH_FACTOR',
      severity: 'error',
      message:
        'The configured minimum Health Factor must be greater than 1.0 (the liquidation boundary).',
    });
  }

  const availableBorrowResult = calculateAvailableBorrow(
    collateralValueResult.value,
    input.protocol.maxLoanToValue,
    input.debt.balance,
  );
  if (!availableBorrowResult.ok) return createFailure(availableBorrowResult.error, options);

  if (availableBorrowResult.value <= 0) {
    findings.push({
      check: 'BORROWING_CAPACITY',
      severity: 'warning',
      message: 'No borrowing capacity is available; the strategy cannot execute any loops.',
    });
  }

  if (findings.some((f) => f.severity === 'error')) {
    return createSuccess({ viable: false, findings, strategy: null }, options);
  }

  const strategyResult = calculateLoopStrategy(input);
  if (!strategyResult.ok) return createFailure(strategyResult.error, options);

  // Defense in depth: calculateLoopStrategy's own for-loop is bounded by
  // input.maxLoops, so this can never actually fire for a correct
  // implementation; kept as an explicit, re-verified safety check per the
  // M2-018 "Maximum loop count" requirement rather than trusted implicitly.
  if (strategyResult.value.steps.length > input.maxLoops) {
    findings.push({
      check: 'MAXIMUM_LOOP_COUNT',
      severity: 'error',
      message: 'The strategy took more steps than the configured maximum loop count.',
    });
  }

  // finalCollateral is always either the validated initial input or a
  // committed step's collateralAfter (see calculateLoopStep.ts), so this
  // branch is unreachable given valid inputs; kept for defense in depth.
  const finalCollateralValueResult = calculateCollateralValue(
    strategyResult.value.finalCollateral,
    input.market,
  );
  if (!finalCollateralValueResult.ok)
    return createFailure(finalCollateralValueResult.error, options);

  const finalLoanToValueResult = calculateLoanToValue(
    strategyResult.value.finalDebt,
    finalCollateralValueResult.value,
  );
  if (!finalLoanToValueResult.ok) return createFailure(finalLoanToValueResult.error, options);

  // Defense in depth: each committed loop step only ever borrows up to
  // available capacity (Available Borrow F-013 = capacity - debt), so the
  // resulting debt can never push LTV past maxLoanToValue; re-verified per
  // the M2-018 "Maximum LTV" requirement rather than trusted implicitly.
  if (finalLoanToValueResult.value > input.protocol.maxLoanToValue) {
    findings.push({
      check: 'MAXIMUM_LTV',
      severity: 'error',
      message: 'The resulting Loan-to-Value exceeds the configured maximum LTV.',
    });
  }

  return createSuccess(
    {
      viable: !findings.some((f) => f.severity === 'error'),
      findings,
      strategy: strategyResult.value,
    },
    options,
  );
}
