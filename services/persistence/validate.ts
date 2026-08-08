/**
 * Persistence validation entry point — 06_TASKS.md M8-005 ("Implement
 * Persistence Validation"). DoD: "Invalid persisted data cannot enter
 * application state silently."
 *
 * Combines M8-004's migration runner with M8-003's envelope schema and
 * each record type's own payload schema (`./schemas`) into the one
 * function every adapter read path and the Import Service (M8-040+) must
 * call before any stored or imported value reaches a Store.
 *
 * **Also enforces M8-051's "Sensitive Data Exclusion Rules"** — this is
 * the one choke point every read, write, and import already passes
 * through, so it is where `findSensitiveField`
 * (`services/shared/sensitiveFields.ts`) is called too, rather than
 * duplicating the check separately in `PersistenceService.write`/
 * `ImportValidator.ts`. See that module's own header comment for why
 * this check exists despite no legitimate payload ever containing one of
 * these fields.
 *
 * **Also enforces checksum verification (06_TASKS.md M9-032 "Audit
 * Import Security," "Corrupted checksums") — wired in this batch, a
 * genuine defect fix.** `envelope.ts`'s `verifyChecksum` existed and was
 * unit-tested in isolation since M8-003, but was never actually called
 * from this or any other production code path — a `tampered` local-
 * storage entry or a hand-edited import file with a stale checksum
 * would pass through unnoticed (confirmed by a repo-wide search finding
 * zero callers before this fix). Checked here, at the same established
 * chokepoint as the sensitive-field check, right after the envelope/
 * payload schema itself validates — so it applies uniformly to every
 * read, write, and import. `verifyChecksum` already treats an omitted
 * checksum as valid (the documented path for hand-authored or
 * pre-M8-003 data), so this addition rejects only a genuine mismatch
 * between a *present* checksum and its payload, never a legitimately
 * checksum-less record.
 *
 * **Checked in `validatePersistedRecordSchema`, after any migration —
 * the same single chokepoint the sensitive-field check already uses, so
 * both of this function's callers (`validatePersistedRecord`'s normal
 * read/write/import path, and `localDataMigration.ts`'s own direct call
 * on its already-migrated data) are covered by one check, not two.**
 * `REGISTERED_MIGRATIONS` is still empty in production
 * (`./migrations/migrate.ts`'s own header comment), so there is no real
 * migration step today whose payload transform could make a genuinely
 * uncorrupted record's checksum stop matching after migration — but a
 * *future* migration step that changes a payload's shape should
 * recompute the checksum as part of its own `migrate()` transform, or a
 * correctly-migrated record would start failing this check for a
 * structural reason, not a corruption one. Documented here as a
 * forward-looking constraint on any future `MigrationStep`, not a
 * currently-observable bug.
 *
 * **Verified against the raw, pre-schema-parse payload (`data`), not
 * `parsed.data.payload` — a real bug found while wiring this in, not a
 * hypothetical.** `createEnvelope`'s own `computeChecksum` runs over
 * whatever payload it is given, before any Zod stripping; a strict,
 * fully-typed payload schema (e.g. portfolio's) strips unknown top-level
 * fields as part of parsing (M8-051's own "strict schemas already do
 * this" finding — see `validate.test.ts`'s own test of that exact
 * behavior). Verifying against the post-strip `parsed.data.payload`
 * would therefore spuriously reject any legitimately-written record
 * whose original payload ever carried an extra field a strict schema
 * later strips — caught by this file's own regression suite, which
 * exercises exactly that case.
 *
 * **Also enforces a maximum payload nesting depth (06_TASKS.md M9-032,
 * "Deeply nested data") — a genuine gap found and fixed this batch.**
 * `findSensitiveField` (`services/shared/sensitiveFields.ts`) recurses
 * through a payload with no depth bound; a pathologically deep import
 * payload could exhaust the call stack instead of failing safely. See
 * `services/shared/payloadLimits.ts`'s own header comment for the full
 * reasoning and why the bounding check is a separate pre-check, not a
 * depth parameter threaded through `findSensitiveField` itself.
 */
import { createApplicationError } from '@/services/shared/errors';
import type { MappingResult } from '@/services/shared/mappingResult';
import { exceedsMaxNestingDepth } from '@/services/shared/payloadLimits';
import { findSensitiveField } from '@/services/shared/sensitiveFields';

import { STORAGE_SCHEMA_VERSION, verifyChecksum } from './envelope';
import { REGISTERED_MIGRATIONS, runMigrations } from './migrations/migrate';
import { createEnvelopeSchema, PAYLOAD_SCHEMAS_BY_RECORD_TYPE } from './schemas';
import type { PersistedRecordType, StorageEnvelope } from './types/envelope';

function verifyRawChecksum(data: unknown): boolean {
  if (typeof data !== 'object' || data === null || !('payload' in data)) return true;
  return verifyChecksum(data as StorageEnvelope<unknown>);
}

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

  if (!verifyRawChecksum(data)) {
    return {
      ok: false,
      errors: [
        createApplicationError(
          'persistence',
          'CHECKSUM_MISMATCH',
          `This "${recordType}" record's checksum does not match its payload and may be corrupted or tampered with.`,
        ),
      ],
    };
  }

  if (exceedsMaxNestingDepth(parsed.data.payload)) {
    return {
      ok: false,
      errors: [
        createApplicationError(
          'persistence',
          'PAYLOAD_TOO_DEEPLY_NESTED',
          `This "${recordType}" record was rejected because its payload is nested too deeply to validate safely.`,
        ),
      ],
    };
  }

  const sensitiveField = findSensitiveField(parsed.data.payload);
  if (sensitiveField !== null) {
    return {
      ok: false,
      errors: [
        createApplicationError(
          'persistence',
          'SENSITIVE_FIELD_REJECTED',
          `This "${recordType}" record was rejected because it contains a prohibited field ("${sensitiveField}"). ProfitPilot never stores credentials, keys, or tokens.`,
        ),
      ],
    };
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
