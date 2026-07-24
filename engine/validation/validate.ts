import { Decimal, type DecimalInput, toDecimal } from '../shared/decimal';
import type { FormulaError } from '../shared/result';
import type { ProtocolParameters } from '../shared/types';

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
