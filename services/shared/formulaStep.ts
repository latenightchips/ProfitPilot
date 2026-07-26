/**
 * Formula-call stepping — a shared helper for Services that compose
 * multiple `FormulaResult<T>`-returning Engine calls into one
 * `ServiceResult<T>`.
 *
 * Originally written inline in `services/portfolio/summary.ts` (M3-005)
 * to solve conflict #19 (formula-version aggregation across a
 * multi-Engine-call Service): track the first successful call's
 * `engineVersion`/`formulaVersion`, and fail loudly
 * (`FORMULA_VERSION_MISMATCH`) rather than silently picking one if a
 * later call in the same composition ever disagrees. Promoted here at
 * M3-009 (Simulation Service), which needs the identical mechanism —
 * the same "relocate to `services/shared/` once a second consumer needs
 * it" trigger already used for `MappingResult<T>` at M3-007. `summary.ts`
 * now imports from here instead of defining its own copy.
 */
import type { FormulaResult } from '@/engine';

import { type ApplicationError, createApplicationError } from './errors';
import {
  createServiceFailure,
  type CreateServiceResultOptions,
  type ServiceFailure,
  type ServiceWarning,
} from './result';

export interface TrackedFormulaVersion {
  engineVersion: string;
  formulaVersion: string;
}

export type FormulaStep<T> =
  | { ok: true; value: T; tracked: TrackedFormulaVersion; warnings: ServiceWarning[] }
  | { ok: false; failure: ServiceFailure };

export function optionsFromTracked(
  sourceStatus: string,
  metadata: { engineVersion: string; formulaVersion: string },
): CreateServiceResultOptions {
  return {
    sourceStatus,
    engineVersion: metadata.engineVersion,
    formulaVersion: metadata.formulaVersion,
  };
}

/**
 * Processes one `FormulaResult<T>` within a multi-call composition: on
 * failure, wraps the Engine error as an `ApplicationError` and returns a
 * ready-to-return `ServiceFailure`. On success, checks the call's
 * `formulaVersion` against whatever has been tracked so far (`null` on
 * the first call) and fails loudly on a mismatch instead of silently
 * choosing one — see conflict #19.
 */
export function formulaStep<T>(
  result: FormulaResult<T>,
  tracked: TrackedFormulaVersion | null,
  sourceStatus: string,
): FormulaStep<T> {
  if (!result.ok) {
    const error: ApplicationError = createApplicationError(
      'calculation',
      result.error.code,
      result.error.message,
    );
    return {
      ok: false,
      failure: createServiceFailure([error], optionsFromTracked(sourceStatus, result.metadata)),
    };
  }

  if (tracked !== null && tracked.formulaVersion !== result.metadata.formulaVersion) {
    const error: ApplicationError = createApplicationError(
      'calculation',
      'FORMULA_VERSION_MISMATCH',
      `Composed calculations reported differing formula versions ("${tracked.formulaVersion}" vs "${result.metadata.formulaVersion}") — a single ServiceMetadata.formulaVersion cannot be derived (see PROJECT_STATUS.md conflict #19).`,
    );
    return {
      ok: false,
      failure: createServiceFailure([error], optionsFromTracked(sourceStatus, result.metadata)),
    };
  }

  return {
    ok: true,
    value: result.value,
    tracked: tracked ?? {
      engineVersion: result.metadata.engineVersion,
      formulaVersion: result.metadata.formulaVersion,
    },
    warnings: result.warnings,
  };
}
