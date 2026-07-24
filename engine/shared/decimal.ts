import Decimal from 'decimal.js';

/**
 * Decimal.js is the Engine's only arithmetic library — 04_BUILD_GUIDE.md
 * ("Formula Engine Implementation"): "Recommended library: decimal.js ...
 * Do not combine both libraries." Configured once, globally, here.
 *
 * 02_Formulas.md "ROUNDING POLICY": never round intermediate calculations;
 * round only for display. A high working precision keeps intermediate
 * results effectively unrounded until a formula explicitly rounds for
 * output.
 */
Decimal.set({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export type DecimalInput = Decimal | number | string;

/** Converts a public-boundary input (number | string | Decimal) into a Decimal. */
export function toDecimal(value: DecimalInput): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/**
 * Display precision — 02_Formulas.md "PRECISION STANDARD".
 *
 * KNOWN DOCUMENTATION CONFLICT: 02_Formulas.md states Health Factor uses
 * 3 decimals; 01_PRD.md REQ-002 "PRECISION REQUIREMENTS" states 2 decimals.
 * This uses 02_Formulas.md's value, since it is the document of record for
 * calculations. See PROJECT_STATUS.md.
 */
export const DISPLAY_PRECISION = {
  currency: 2,
  btc: 8,
  percentage: 2,
  healthFactor: 3,
  interestRate: 3,
} as const;

/** Rounds a value for display only. Never use this on a value that feeds another calculation. */
export function roundForDisplay(value: DecimalInput, decimals: number): Decimal {
  return toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
}

/** Converts a Decimal to a plain number at the public output boundary. */
export function toOutputNumber(value: Decimal): number {
  return value.toNumber();
}
