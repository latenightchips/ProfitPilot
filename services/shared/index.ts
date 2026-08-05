/**
 * Shared Service infrastructure — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-002 ("Create Standard Service Result Model") and M3-003
 * ("Implement Application Error Model") were its first two occupants.
 * `MappingResult<T>` (originally M3-004, relocated here at M3-007 once a
 * second consumer needed it — see `mappingResult.ts`'s own header
 * comment) is its third.
 */
export {
  type ApplicationError,
  type ApplicationErrorCategory,
  createApplicationError,
} from './errors';
export { type MappingFailure, type MappingResult, type MappingSuccess } from './mappingResult';
export {
  createServiceFailure,
  type CreateServiceResultOptions,
  createServiceSuccess,
  type ServiceFailure,
  type ServiceMetadata,
  type ServiceResult,
  type ServiceSuccess,
  type ServiceWarning,
} from './result';
export { findSensitiveField } from './sensitiveFields';
