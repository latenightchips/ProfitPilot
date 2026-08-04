/**
 * Export file shapes — shared between `JsonExporter.ts` (this batch's own
 * producer) and `services/import/schemas.ts` (M8-041's own consumer,
 * which validates a file claiming to be one of these against this exact
 * shape before trusting anything else in it).
 *
 * Both `FullBackupFile` and `SingleRecordExportFile` wrap the existing
 * `StorageEnvelope<T>` (`services/persistence`, M8-003) unchanged — no
 * new envelope invented, per this batch's own "Use the storage envelope
 * and schema-versioning system from Batches 1–2" instruction. `kind` is
 * the one new field: a discriminator letting the Import Service tell the
 * two file shapes apart before parsing further (M8-041's own "File
 * format" check).
 */
import type { PersistedRecordType, StorageEnvelope } from '../persistence';

export interface ExportFileMeta {
  app: string;
  storageSchemaVersion: string;
  appVersion: string;
  exportedAt: string;
}

/**
 * M8-037's own "Include" list, satisfied field-for-field: "Storage
 * envelope" → every record below stays a full `StorageEnvelope<unknown>`,
 * not an unwrapped payload; "All portfolios... Saved simulations...
 * Preferences" → one array per `PersistedRecordType` actually present
 * locally; "Versions... Timestamps" → `ExportFileMeta` plus each
 * envelope's own `storageSchemaVersion`/`createdAt`/`updatedAt`.
 * `Partial` — a fresh install with e.g. no saved simulations yet omits
 * that key entirely rather than forcing an empty array for every one of
 * the 9 record types on every export.
 */
export interface FullBackupFile extends ExportFileMeta {
  kind: 'full-backup';
  records: Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>;
}

/**
 * M8-038's own DoD — "Single-record exports include all dependencies
 * required to understand and reproduce the record" — satisfied by
 * `dependencies`: for a saved strategy record, its own source portfolio
 * (looked up by the record's own `portfolioId` field, when both the
 * field and a matching local portfolio exist) so the export is
 * self-contained rather than referencing a portfolio the recipient may
 * not have. A plain portfolio record has no dependencies of its own —
 * `dependencies` is `{}` in that case, not an error.
 */
export interface SingleRecordExportFile extends ExportFileMeta {
  kind: 'single-record';
  recordType: PersistedRecordType;
  record: StorageEnvelope<unknown>;
  dependencies: Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>;
}

export type ExportFile = FullBackupFile | SingleRecordExportFile;

export interface ExportResult {
  filename: string;
  content: string;
  mimeType: string;
}
