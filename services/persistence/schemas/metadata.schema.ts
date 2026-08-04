/**
 * Persisted Application/Sync metadata payload validation —
 * 06_TASKS.md M8-005's "Metadata" item. Mirrors `../types/models.ts`'s
 * `PersistedApplicationMetadata`/`PersistedSyncMetadata` field-for-field.
 */
import { z } from 'zod';

import { persistedRecordTypeSchema } from './envelope.schema';

export const persistedApplicationMetadataPayloadSchema = z.object({
  currentStorageSchemaVersion: z.string().min(1),
  installedAt: z.string().datetime(),
  lastOpenedAt: z.string().datetime(),
});

export const persistedSyncMetadataPayloadSchema = z.object({
  recordType: persistedRecordTypeSchema,
  recordId: z.string().min(1),
  lastSyncedAt: z.string().datetime().nullable(),
  cloudUpdatedAt: z.string().datetime().nullable(),
});
