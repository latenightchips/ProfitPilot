/**
 * Persistence Service — public entry point.
 *
 * 06_TASKS.md M8-001 ("Create Persistence Architecture") through M8-050
 * ("Document Disaster Recovery Procedure") — Milestone 8 Batches 1–4.
 * Replaces the M3-001 `export {}` placeholder this file originally was.
 *
 * `./sync.service.ts` has no exports yet — see its own header comment
 * for why (Cloud Synchronization, M8-027 onward, a later dependent
 * Milestone 8 batch that requires a real Supabase project this
 * codebase does not yet have network access to — see
 * `docs/CLOUD_READINESS.md`). `./syncMetadataModel.ts` (M8-026) is
 * exported below — it is the synchronization *model* (pure data and
 * deterministic transitions), authorized ahead of that Service as
 * local-only preparation work; see its own header comment.
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
export * from './recoverySnapshot';
export * from './schemas';
export * from './syncMetadataModel';
export * from './types';
export { validatePersistedRecord, validatePersistedRecordSchema } from './validate';
