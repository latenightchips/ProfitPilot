/**
 * Persistence Service — public entry point.
 *
 * 06_TASKS.md M8-001 ("Create Persistence Architecture") through M8-005
 * ("Implement Persistence Validation") — Milestone 8 Batch 1. Replaces
 * the M3-001 `export {}` placeholder this file was until now.
 *
 * `./sync.service.ts` has no exports yet — see its own header comment
 * for why (Batch 7, a later dependent Milestone 8 batch).
 */
export * from './adapters';
export * from './envelope';
export type { MigrationRegistry, MigrationStep } from './migrations/migrate';
export { runMigrations } from './migrations/migrate';
export * from './persistence.service';
export * from './schemas';
export * from './types';
export { validatePersistedRecord } from './validate';
