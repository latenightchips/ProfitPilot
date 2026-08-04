/**
 * Import file schemas — 06_TASKS.md M8-041 ("Implement Import
 * Validation"). Validates the outer shape of a file claiming to be one
 * of `services/export/types.ts`'s two export file shapes, before
 * `ImportValidator.ts` runs any deeper, per-record check.
 *
 * **`importEnvelopeSchema` extends the bare `storageEnvelopeShapeSchema`
 * with an explicit `payload: z.unknown()`.** The bare schema
 * (`services/persistence/schemas/envelope.schema.ts`) declares no
 * `payload` field at all — only `createEnvelopeSchema(payloadSchema)`, a
 * function, adds one dynamically for a *specific* record type. Using the
 * bare schema here would mean Zod's default "strip unrecognized keys"
 * object behavior silently deletes every record's `payload` during
 * outer-shape validation, before `ImportValidator.ts` ever gets a chance
 * to check it against the real per-record-type payload schema. This
 * schema exists to accept payload as opaque `unknown` at this stage —
 * `ImportValidator.ts` (via `validatePersistedRecord`) is what actually
 * validates each payload against its real, record-type-specific shape.
 *
 * **`z.partialRecord`, not `z.record`, for the per-type record maps.**
 * `z.record(persistedRecordTypeSchema, ...)` requires every one of the 9
 * `PersistedRecordType` keys to be present (Zod v4 treats an enum key
 * record like TypeScript's `Record<K,V>`), so a real export from a fresh
 * install — which omits every record type with zero saved records char
 * — would fail outer-shape validation for every absent key.
 * `z.partialRecord` is Zod's own dedicated API for "some or none of these
 * keys, each optional," matching `FullBackupFile['records']`'s own
 * `Partial<Record<...>>` TypeScript type exactly.
 */
import { z } from 'zod';

import { persistedRecordTypeSchema, storageEnvelopeShapeSchema } from '../persistence';

export const importEnvelopeSchema = storageEnvelopeShapeSchema.extend({ payload: z.unknown() });

export const exportFileMetaSchema = z.object({
  app: z.string().min(1),
  storageSchemaVersion: z.string().min(1),
  appVersion: z.string().min(1),
  exportedAt: z.string(),
});

const partialRecordMapSchema = z.partialRecord(
  persistedRecordTypeSchema,
  z.array(importEnvelopeSchema),
);

export const fullBackupFileSchema = exportFileMetaSchema.extend({
  kind: z.literal('full-backup'),
  records: partialRecordMapSchema,
});

export const singleRecordExportFileSchema = exportFileMetaSchema.extend({
  kind: z.literal('single-record'),
  recordType: persistedRecordTypeSchema,
  record: importEnvelopeSchema,
  dependencies: partialRecordMapSchema,
});

export const importFileSchema = z.discriminatedUnion('kind', [
  fullBackupFileSchema,
  singleRecordExportFileSchema,
]);

export type ImportFileParsed = z.infer<typeof importFileSchema>;
