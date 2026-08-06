/**
 * Persisted Application/Sync metadata payload validation —
 * 06_TASKS.md M8-005's "Metadata" item. Mirrors `../types/models.ts`'s
 * `PersistedApplicationMetadata`/`PersistedSyncMetadata` field-for-field.
 *
 * `persistedSyncMetadataPayloadSchema` was extended at M8-026 ("Create
 * Synchronization Model") from its original minimal shape to the full
 * field set that task's own "Include" list names — see
 * `../types/models.ts`'s `PersistedSyncMetadata` for the field-by-field
 * rationale; this schema validates nothing beyond what that interface
 * already documents.
 *
 * **Migration-safe by construction, not by an added migration step**:
 * no writer for `'syncMetadata'` has ever existed (confirmed by grep —
 * nothing in `services/`, `stores/`, or `app/` calls
 * `service.write('syncMetadata', ...)` anywhere in this codebase today),
 * so this stricter shape cannot invalidate any real previously-persisted
 * record — there is none. This is the same honestly-scoped situation
 * `services/persistence/migrations/migrate.ts`'s own header comment
 * documents for `STORAGE_SCHEMA_VERSION` itself: nothing to migrate
 * *from* yet, so no migration step is invented for data that has never
 * existed.
 */
import { z } from 'zod';

import { persistedRecordTypeSchema } from './envelope.schema';

export const persistedApplicationMetadataPayloadSchema = z.object({
  currentStorageSchemaVersion: z.string().min(1),
  installedAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime(),
});

export const syncStatusSchema = z.enum([
  'synced',
  'pendingUpload',
  'pendingDownload',
  'conflict',
  'error',
]);

export const conflictStatusSchema = z.enum(['none', 'detected', 'resolved']);

export const persistedSyncMetadataPayloadSchema = z.object({
  recordType: persistedRecordTypeSchema,
  recordId: z.string().min(1),
  localUpdatedAt: z.string().datetime(),
  cloudUpdatedAt: z.string().datetime().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
  syncStatus: syncStatusSchema,
  originDeviceId: z.string().min(1),
  deletionMarker: z.string().datetime().nullable(),
  conflictStatus: conflictStatusSchema,
});
