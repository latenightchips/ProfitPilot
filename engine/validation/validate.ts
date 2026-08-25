import { Decimal, type DecimalInput, toDecimal } from '../shared/decimal';
import type { FormulaError } from '../shared/result';
import type { ExecutionCostAssumptions, ProtocolParameters } from '../shared/types';

/**
 * Engine validation utilities — 06_TASKS.md M2-005 ("Implement Engine
 * Validation Utilities"). Invalid inputs must produce standardized errors
 * and never generate silent NaN or infinite results (README.md "ERROR
 * HANDLING"; 01_PRD.md REQ-002 "ERROR HANDLING").
 */
export type ValidationResult<T = Decimal> =
  { ok: true; value: T } | { ok: false; error: FormulaError };

function fail<T>(code: string, message: string): ValidationResult<T> {
  return { ok: false, error: { code, message } };
}

function succeed<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}

/** Rejects NaN, +/-Infinity, and non-numeric input. */
export function validateFinite(value: DecimalInput, field: string): ValidationResult {
  let decimal: Decimal;
  try {
    decimal = toDecimal(value);
  } catch {
    return fail('INVALID_FINITE', `${field} must be a finite number.`);
  }
  if (!decimal.isFinite()) {
    return fail('INVALID_FINITE', `${field} must be a finite number.`);
  }
  return succeed(decimal);
}

export function validateNonNegative(value: DecimalInput, field: string): ValidationResult {
  const finite = validateFinite(value, field);
  if (!finite.ok) return finite;
  if (finite.value.isNegative()) {
    return fail('INVALID_NON_NEGATIVE', `${field} must not be negative.`);
  }
  return finite;
}

export function validatePositive(value: DecimalInput, field: string): ValidationResult {
  const finite = validateFinite(value, field);
  if (!finite.ok) return finite;
  if (!finite.value.isPositive() || finite.value.isZero()) {
    return fail('INVALID_POSITIVE', `${field} must be greater than zero.`);
  }
  return finite;
}

/** Percentages are decimals (0.8, not 80) and must fall within [0, 1] — 04_BUILD_GUIDE.md. */
export function validatePercentage(value: DecimalInput, field: string): ValidationResult {
  const nonNegative = validateNonNegative(value, field);
  if (!nonNegative.ok) return nonNegative;
  if (nonNegative.value.greaterThan(1)) {
    return fail(
      'INVALID_PERCENTAGE',
      `${field} must be expressed as a decimal between 0 and 1 (e.g. 0.8 for 80%).`,
    );
  }
  return nonNegative;
}

export function validatePrice(value: DecimalInput, field: string): ValidationResult {
  return validatePositive(value, field);
}

export function validateTokenQuantity(value: DecimalInput, field: string): ValidationResult {
  return validateNonNegative(value, field);
}

/** APR / APY. README.md "ERROR HANDLING" explicitly lists "APR < 0" as an invalid input. */
export function validateRate(value: DecimalInput, field: string): ValidationResult {
  return validateNonNegative(value, field);
}

export function validateThreshold(value: DecimalInput, field: string): ValidationResult {
  return validatePercentage(value, field);
}

export function validateTimePeriod(value: DecimalInput, field: string): ValidationResult {
  return validateNonNegative(value, field);
}

/**
 * Execution-cost friction rate (Swap Fee Rate / Slippage Rate) —
 * 02_Formulas.md F-070/F-071 (V4 Readiness Audit §12 P1-5). Decimal
 * fraction in [0, 1) — strictly less than 1, unlike `validatePercentage`'s
 * [0, 1] (a rate at exactly 1 would mean 100% friction on that one leg,
 * which `resolveEffectiveExecutionRate` below must reject rather than let
 * silently collapse Effective Rate toward zero).
 */
export function validateExecutionCostRate(value: DecimalInput, field: string): ValidationResult {
  const nonNegative = validateNonNegative(value, field);
  if (!nonNegative.ok) return nonNegative;
  if (nonNegative.value.greaterThanOrEqualTo(1)) {
    return fail(
      'INVALID_EXECUTION_COST_RATE',
      `${field} must be expressed as a decimal fraction in [0, 1) — a value of 1 or greater would imply 100% or more execution friction on its own.`,
    );
  }
  return nonNegative;
}

/**
 * The single, shared implementation of 02_Formulas.md's F-070/F-071
 * "Effective Rate" — `(1 - swapFeeRate) * (1 - slippageRate)`, the
 * canonical MULTIPLICATIVE composition (not additive — see
 * 02_Formulas.md's "RATE COMPOSITION" section). Every consumer of
 * execution-cost friction (`calculateBtcPurchasedPerLoop`/F-070,
 * `calculateBtcSaleRequired`/F-071) calls this instead of re-deriving the
 * composition itself, so the two rates can never drift into two different
 * formulas by accident.
 *
 * `assumptions` is optional — omitted is treated identically to
 * `{ swapFeeRate: 0, slippageRate: 0 }`, which yields Effective Rate
 * exactly `1` (a true Decimal `1`, not a floating-point approximation),
 * preserving byte-for-byte backward compatibility with every pre-P1-5
 * caller that never supplies execution-cost assumptions at all.
 *
 * The zero-lower-bound defense-in-depth check below is mathematically
 * unreachable given `validateExecutionCostRate`'s own [0, 1) domain on
 * each individual rate (the product of two factors each in (0, 1] can
 * never reach zero or go negative) — kept anyway, the same "unreachable
 * given already-validated inputs, kept for defense in depth" convention
 * `calculateLoopStep.ts`/`calculateExitPosition.ts` already established
 * elsewhere in this Engine.
 */
export function resolveEffectiveExecutionRate(
  assumptions: ExecutionCostAssumptions | undefined,
): ValidationResult {
  const swapFeeRate = assumptions?.swapFeeRate ?? 0;
  const slippageRate = assumptions?.slippageRate ?? 0;

  const fee = validateExecutionCostRate(swapFeeRate, 'swapFeeRate');
  if (!fee.ok) return fee;

  const slippage = validateExecutionCostRate(slippageRate, 'slippageRate');
  if (!slippage.ok) return slippage;

  const effectiveRate = Decimal.sub(1, fee.value).times(Decimal.sub(1, slippage.value));
  if (effectiveRate.lessThanOrEqualTo(0)) {
    return fail(
      'INVALID_EFFECTIVE_EXECUTION_RATE',
      'The combined execution-cost Effective Rate must be greater than zero.',
    );
  }
  return succeed(effectiveRate);
}

export interface ValidatedProtocolParameters {
  maxLoanToValue: Decimal;
  liquidationThreshold: Decimal;
  borrowApr: Decimal;
  supplyApr: Decimal;
}

/**
 * Validates a full protocol-parameter set, including the invariant that
 * maximum LTV must not exceed the liquidation threshold — 04_BUILD_GUIDE.md
 * "Engine invariants".
 */
export function validateProtocolParameters(
  params: ProtocolParameters,
): ValidationResult<ValidatedProtocolParameters> {
  const maxLoanToValue = validatePercentage(params.maxLoanToValue, 'maxLoanToValue');
  if (!maxLoanToValue.ok) return maxLoanToValue;

  const liquidationThreshold = validatePercentage(
    params.liquidationThreshold,
    'liquidationThreshold',
  );
  if (!liquidationThreshold.ok) return liquidationThreshold;

  const borrowApr = validateRate(params.borrowApr, 'borrowApr');
  if (!borrowApr.ok) return borrowApr;

  const supplyApr = validateRate(params.supplyApr, 'supplyApr');
  if (!supplyApr.ok) return supplyApr;

  if (maxLoanToValue.value.greaterThan(liquidationThreshold.value)) {
    return fail(
      'INVALID_PROTOCOL_PARAMETERS',
      'maxLoanToValue must not exceed liquidationThreshold.',
    );
  }

  return succeed({
    maxLoanToValue: maxLoanToValue.value,
    liquidationThreshold: liquidationThreshold.value,
    borrowApr: borrowApr.value,
    supplyApr: supplyApr.value,
  });
}
