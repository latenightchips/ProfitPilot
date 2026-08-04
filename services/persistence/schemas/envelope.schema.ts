/**
 * Storage Envelope validation — 06_TASKS.md M8-005 ("Implement
 * Persistence Validation"). Validates the "Envelope structure, Schema
 * version, Identifiers, Timestamps" items from that task's own "Validate"
 * list; each concrete record type's own "Payload" item is layered on top
 * by `./index.ts`'s `PAYLOAD_SCHEMAS_BY_RECORD_TYPE`.
 */
import { z } from 'zod';

import { PERSISTED_RECORD_TYPES } from '../types/envelope';

export const persistedRecordTypeSchema = z.enum(PERSISTED_RECORD_TYPES);

export const storageEnvelopeShapeSchema = z.object({
  app: z.string().min(1),
  storageSchemaVersion: z.string().min(1),
  appVersion: z.string().min(1),
  recordType: persistedRecordTypeSchema,
  recordId: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  checksum: z.string().min(1).optional(),
});

/**
 * Combines the envelope shape with a specific record type's payload
 * schema. `z.unknown()` is deliberately the default `payloadSchema` —
 * callers that only need to check the envelope itself (e.g. reading
 * `recordType` before deciding which real payload schema to apply) are
 * not forced to supply one.
 */
export function createEnvelopeSchema<PayloadSchema extends z.ZodTypeAny>(
  payloadSchema: PayloadSchema,
) {
  return storageEnvelopeShapeSchema.extend({ payload: payloadSchema });
}
