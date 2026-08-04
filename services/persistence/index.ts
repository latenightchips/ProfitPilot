/**
 * Persistence Service — public entry point.
 *
 * 06_TASKS.md M8-001 ("Create Persistence Architecture") through M8-013
 * ("Implement Local Data Migration Runner") — Milestone 8 Batches 1–2.
 * Replaces the M3-001 `export {}` placeholder this file originally was.
 *
 * `./sync.service.ts` has no exports yet — see its own header comment
 * for why (Batch 7, a later dependent Milestone 8 batch).
 */
export * from './adapters';
export * from './autoSaveCoordinator';
export * from './constants';
export * from './envelope';
export type { LocalMigrationReport, LocalMigrationStatus } from './migrations/localDataMigration';
export { runLocalDataMigration } from './migrations/localDataMigration';
export type { MigrationRegistry, MigrationStep } from './migrations/migrate';
export { REGISTERED_MIGRATIONS, runMigrations } from './migrations/migrate';
export * from './persistence.service';
export * from './schemas';
export * from './types';
export { validatePersistedRecord, validatePersistedRecordSchema } from './validate';
