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
 * Validates an already-current-version value against its envelope and
 * payload schemas — no migration. Exported separately from
 * `validatePersistedRecord` for `./migrations/localDataMigration.ts`
 * (M8-013): that function already migrates each record itself using its
 * *own* (possibly test-injected) `MigrationRegistry` before calling this;
 * routing that already-migrated data back through
 * `validatePersistedRecord` would migrate it a *second* time using the
 * hardcoded production `REGISTERED_MIGRATIONS`, which is wrong whenever
 * the two registries differ (always true in that function's own tests)
 * and redundant even when they don't.
 */
export function validatePersistedRecordSchema<T>(
  recordType: PersistedRecordType,
  data: unknown,
): MappingResult<StorageEnvelope<T>> {
  const payloadSchema = PAYLOAD_SCHEMAS_BY_RECORD_TYPE[recordType];
  const envelopeSchema = createEnvelopeSchema(payloadSchema);
  const parsed = envelopeSchema.safeParse(data);
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

/**
 * Validates a raw, untrusted value (from `localStorage`, an imported
 * file, or a Supabase row) as a `StorageEnvelope<T>` of the given record
 * type. Migrates older-but-supported schema versions first (using the
 * production `REGISTERED_MIGRATIONS`); rejects unsupported/future
 * versions and structurally invalid payloads without throwing.
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

  return validatePersistedRecordSchema<T>(recordType, migrated.data);
}
