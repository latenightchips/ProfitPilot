/**
 * Application Error Model — 06_TASKS.md M3-003 ("Implement Application
 * Error Model").
 *
 * The Service-layer analog of `engine/shared/result.ts`'s `FormulaError`
 * (`{code, message}`), extended with the `category` taxonomy M3-003's own
 * "Categories" list names explicitly — the 9 values below are exactly
 * that list, no others invented.
 *
 * DoD ("Service errors can be displayed safely without exposing internal
 * implementation details"): `message` must always be a safe, user-facing
 * string — never a raw exception message, stack trace, or internal
 * identifier — the same discipline `FormulaError.message` already
 * follows throughout the Engine (01_PRD.md REQ-002 "ERROR HANDLING").
 * `code` is a machine-readable identifier for programmatic handling
 * (e.g. logging, retry logic), mirroring the Engine's own
 * `FormulaError.code` convention; it is not itself required to be safe
 * to display, but must not contain anything more sensitive than a short,
 * stable identifier.
 */

/**
 * 06_TASKS.md M3-003 "Categories," verbatim.
 */
export type ApplicationErrorCategory =
  | 'validation'
  | 'calculation'
  | 'persistence'
  | 'provider'
  | 'authentication'
  | 'synchronization'
  | 'import'
  | 'export'
  | 'unknown';

export interface ApplicationError {
  category: ApplicationErrorCategory;
  code: string;
  message: string;
}

export function createApplicationError(
  category: ApplicationErrorCategory,
  code: string,
  message: string,
): ApplicationError {
  return { category, code, message };
}
