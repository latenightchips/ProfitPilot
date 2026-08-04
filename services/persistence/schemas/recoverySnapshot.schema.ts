/**
 * Persisted Recovery Snapshot payload validation — 06_TASKS.md M8-005's
 * validation discipline, extended in Milestone 8 Batch 4 for M8-046's
 * new `'recoverySnapshot'` record type. Mirrors `../types/models.ts`'s
 * `PersistedRecoverySnapshot` field-for-field.
 *
 * **`snapshottedEnvelopeSchema` extends the bare `storageEnvelopeShapeSchema`
 * with an explicit `payload: z.unknown()`, and the records map uses
 * `z.partialRecord`, not `z.record`** — the same two fixes
 * `services/import/schemas.ts` already needed for the identical
 * "envelope wrapping other envelopes" shape (bare `storageEnvelopeShapeSchema`
 * declares no `payload` field at all, so it would otherwise be silently
 * stripped; `z.record` requires every enum key present, which a snapshot
 * of a fresh or partially-populated dataset never has). Duplicated here
 * rather than imported from `services/import/` to keep the dependency
 * direction Services → lower Services, never the reverse — persistence is
 * the lower-level module import/export itself depends on.
 */
import { z } from 'zod';

import { persistedRecordTypeSchema, storageEnvelopeShapeSchema } from './envelope.schema';

const recoverySnapshotReasonSchema = z.enum([
  'migration',
  'large-import',
  'full-replacement',
  'conflict-resolution',
  'bulk-deletion',
]);

const snapshottedEnvelopeSchema = storageEnvelopeShapeSchema.extend({ payload: z.unknown() });

export const persistedRecoverySnapshotPayloadSchema = z.object({
  reason: recoverySnapshotReasonSchema,
  createdAt: z.string().datetime(),
  records: z.partialRecord(persistedRecordTypeSchema, z.array(snapshottedEnvelopeSchema)),
});
