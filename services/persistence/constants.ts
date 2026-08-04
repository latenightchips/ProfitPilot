/**
 * Persistence-wide constants — Milestone 8 Batch 2.
 *
 * `SINGLETON_RECORD_ID` is the well-known record ID every app-wide,
 * one-instance-only record type uses (`'preferences'`,
 * `'applicationMetadata'`, `'activePortfolio'`) — a single shared
 * constant rather than each caller inventing its own literal string, so
 * a read and a write of the same singleton can never accidentally use
 * different IDs.
 */
export const SINGLETON_RECORD_ID = 'singleton';
