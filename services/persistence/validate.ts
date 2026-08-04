/**
 * Persistence validation entry point — 06_TASKS.md M8-005 ("Implement
 * Persistence Validation"). DoD: "Invalid persisted data cannot enter
 * application state silently."
 *
 * Combines M8-004's migration runner with M8-003's envelope schema and
 * each record type's own payload schema (`./schemas`) into the one
 * function every adapter read path and the Import Service (M8-040+) must
 * call before any stored or imported value reaches a Store.
 */
import { createApplicationError } from '@/services/shared/errors';
import type { MappingResult } from '@/services/shared/mappingResult';

import { STORAGE_SCHEMA_VERSION } from './envelope';
import { REGISTERED_MIGRATIONS, runMigrations } from './migrations/migrate';
import { createEnvelopeSchema, PAYLOAD_SCHEMAS_BY_RECORD_TYPE } from './schemas';
import type { PersistedRecordType, StorageEnvelope } from './types/envelope';

function zodErrorToMappingFailure(
  recordType: PersistedRecordType,
  issues: string[],
): MappingResult<never> {
  return {
    ok: false,
    errors: [
      createApplicationError(
        'persistence',
        'INVALID_PERSISTED_RECORD',
        `Stored "${recordType}" data is invalid and could not be loaded (${issues.join('; ')}).`,
      ),
    ],
  };
}

/**
 * Validates a raw, untrusted value (from `localStorage`, an imported
 * file, or a Supabase row) as a `StorageEnvelope<T>` of the given record
 * type. Migrates older-but-supported schema versions first; rejects
 * unsupported/future versions and structurally invalid payloads without
 * throwing.
 */
export function validatePersistedRecord<T>(
  recordType: PersistedRecordType,
  raw: unknown,
): MappingResult<StorageEnvelope<T>> {
  const migrated = runMigrations(raw, {
    currentVersion: STORAGE_SCHEMA_VERSION,
    steps: REGISTERED_MIGRATIONS,
  });
  if (!migrated.ok) return migrated;

  const payloadSchema = PAYLOAD_SCHEMAS_BY_RECORD_TYPE[recordType];
  const envelopeSchema = createEnvelopeSchema(payloadSchema);
  const parsed = envelopeSchema.safeParse(migrated.data);
  if (!parsed.success) {
    return zodErrorToMappingFailure(
      recordType,
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    );
  }

  if (parsed.data.recordType !== recordType) {
    return zodErrorToMappingFailure(recordType, [
      `expected recordType "${recordType}", found "${parsed.data.recordType}"`,
    ]);
  }

  return { ok: true, data: parsed.data as StorageEnvelope<T> };
}
