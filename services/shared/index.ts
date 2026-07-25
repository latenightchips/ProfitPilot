/**
 * Shared Service infrastructure — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-002 ("Create Standard Service Result Model") and M3-003
 * ("Implement Application Error Model") are its first two occupants.
 */
export {
  type ApplicationError,
  type ApplicationErrorCategory,
  createApplicationError,
} from './errors';
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
