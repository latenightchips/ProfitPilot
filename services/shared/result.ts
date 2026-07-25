/**
 * Standard Service Result Model — 06_TASKS.md M3-002 ("Create Standard
 * Service Result Model").
 *
 * The Service-layer analog of `engine/shared/result.ts`'s
 * `FormulaResult<T>`, reusing the same discriminated-union shape
 * (`{ok:true}` / `{ok:false}`) rather than a single envelope with
 * nullable fields — the Engine convention this project has proven across
 * all 45 public Engine functions, and nothing in M3-002's own text rules
 * it out. Approved design decision: no partial-success semantics
 * (simultaneous `data` and `errors`) are introduced, since the
 * specification does not define what a partial success would mean for
 * any given Service. See PROJECT_STATUS.md's Milestone 3 Batch 2 section
 * for the full reasoning.
 *
 * `errors` (plural) on `ServiceFailure`, unlike the Engine's single
 * `error`, is a deliberate, literal reading of M3-002's own "Include"
 * list, which names "Errors" — a Service can legitimately aggregate more
 * than one `ApplicationError` (e.g. several invalid fields at once),
 * unlike an atomic Engine formula call, which always fails on the first
 * invalid input.
 *
 * `metadata.sourceStatus` is typed as a plain `string`, not an enum: the
 * term "Source status" appears exactly once in `06_TASKS.md` (this
 * task's own "Include" list) with no documented values anywhere in the
 * specification. Inventing a taxonomy here would mean guessing at
 * business rules the specification doesn't state — see PROJECT_STATUS.md
 * conflict entry for this batch.
 *
 * `metadata.formulaVersion` is singular, matching this task's own
 * "Include" wording, and describes one Engine call's metadata. How a
 * Service that composes multiple Engine calls (e.g. the future Portfolio
 * Summary Service, M3-005) aggregates multiple `formulaVersion` values
 * into one `ServiceResult` is explicitly left to that later task, not
 * solved here.
 */
import type { ApplicationError } from './errors';

export interface ServiceWarning {
  code: string;
  message: string;
}

export interface ServiceMetadata {
  /** No documented value domain — see this file's header comment. */
  sourceStatus: string;
  calculationTimestamp: string;
  engineVersion: string;
  formulaVersion: string;
}

export interface ServiceSuccess<T> {
  ok: true;
  data: T;
  warnings: ServiceWarning[];
  metadata: ServiceMetadata;
}

export interface ServiceFailure {
  ok: false;
  errors: ApplicationError[];
  metadata: ServiceMetadata;
}

export type ServiceResult<T> = ServiceSuccess<T> | ServiceFailure;

export interface CreateServiceResultOptions {
  /** No documented value domain — see this file's header comment. */
  sourceStatus: string;
  /**
   * Not hardcoded to a hidden constant, unlike the Engine's own private
   * `ENGINE_VERSION`: a Service call's Engine version should come from
   * the actual `FormulaResult.metadata.engineVersion` of whichever
   * Engine function(s) it called, not a separately maintained value that
   * could drift out of sync.
   */
  engineVersion: string;
  formulaVersion: string;
}

function buildMetadata(options: CreateServiceResultOptions): ServiceMetadata {
  return {
    sourceStatus: options.sourceStatus,
    calculationTimestamp: new Date().toISOString(),
    engineVersion: options.engineVersion,
    formulaVersion: options.formulaVersion,
  };
}

export function createServiceSuccess<T>(
  data: T,
  options: CreateServiceResultOptions,
  warnings: ServiceWarning[] = [],
): ServiceSuccess<T> {
  return { ok: true, data, warnings, metadata: buildMetadata(options) };
}

export function createServiceFailure(
  errors: ApplicationError[],
  options: CreateServiceResultOptions,
): ServiceFailure {
  return { ok: false, errors, metadata: buildMetadata(options) };
}
