/**
 * Persistence Service — public entry point.
 *
 * 06_TASKS.md M8-001 ("Create Persistence Architecture") through M8-050
 * ("Document Disaster Recovery Procedure") — Milestone 8 Batches 1–4.
 * Replaces the M3-001 `export {}` placeholder this file originally was.
 *
 * **Milestone 8 is re-scoped to local-only persistence** (product
 * decision — see `docs/MILESTONE_8_SCOPE_CHANGE.md`). Cloud Database and
 * Cloud Synchronization are cancelled; `./sync.service.ts` (the empty
 * stub reserved for that cancelled Service) has been removed.
 * `./syncMetadataModel.ts` (M8-026, exported below) is retained as a
 * generic domain model — pure data and deterministic transitions with no
 * Supabase dependency — per that same decision.
 */
export * from './adapters';
export * from './autoSaveCoordinator';
export * from './clearLocalData';
export * from './constants';
export * from './envelope';
export type { LocalMigrationReport, LocalMigrationStatus } from './migrations/localDataMigration';
export { runLocalDataMigration } from './migrations/localDataMigration';
export type { MigrationRegistry, MigrationStep } from './migrations/migrate';
export { REGISTERED_MIGRATIONS, runMigrations } from './migrations/migrate';
export * from './persistence.service';
export * from './portfolioHistory';
export * from './recoverySnapshot';
export * from './schemas';
export * from './syncMetadataModel';
export * from './types';
export { validatePersistedRecord, validatePersistedRecordSchema } from './validate';
