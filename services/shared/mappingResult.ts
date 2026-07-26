/**
 * Mapping Result — a shared, layer-agnostic `{ok, data}` / `{ok, errors}`
 * envelope for pure data-transformation Services that make no Engine
 * calculation and therefore have no real `ServiceMetadata`
 * (`engineVersion`/`formulaVersion`) to report.
 *
 * Originally introduced at M3-004 (`services/portfolio/mapping.ts`, see
 * that file and PROJECT_STATUS.md's Milestone 3 Batch 3 section for the
 * full reasoning: forcing `ServiceResult<T>`'s Engine-provenance
 * metadata onto an operation that never calls the Engine means
 * fabricating a value with no real source). That batch's own
 * documentation named the promotion trigger explicitly: "the first time
 * a second mapping utility needs it." M3-007 (Market Data Service,
 * `services/market/quote.ts`) is that second utility —
 * `normalizeMarketQuote` performs no Engine call either, so it reuses
 * this exact type rather than re-inventing it.
 *
 * `services/portfolio/mapping.ts` re-exports these names from here
 * rather than defining its own copy, so M3-004's already-committed
 * public API (`@/services`) is unchanged by this relocation.
 */
import type { ApplicationError } from './errors';

export interface MappingSuccess<T> {
  ok: true;
  data: T;
}

export interface MappingFailure {
  ok: false;
  errors: ApplicationError[];
}

export type MappingResult<T> = MappingSuccess<T> | MappingFailure;
