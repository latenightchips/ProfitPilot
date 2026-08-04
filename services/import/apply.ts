/**
 * Import Apply — 06_TASKS.md M8-042/M8-043 ("Implement Import Merge
 * Strategies") and M8-044 ("Implement Import Replace Strategy" /
 * "Implement Automatic Local Recovery Snapshot before destructive
 * imports"). DoD: "Replacement requires explicit confirmation," "A
 * recovery snapshot exists before any destructive import."
 *
 * **Snapshot-then-restore, the same idiom
 * `migrations/localDataMigration.ts` already established for "the whole
 * dataset must end up correct, or nothing changes at all."** This
 * function snapshots every record type via `PersistenceService` (not a
 * raw `PersistenceAdapter` — this stays above that boundary, same as
 * every other Import/Export function) before making any change, and
 * restores that exact snapshot on any failure at any step, for
 * *every* merge mode, not just `replaceAll` — an `addAsNew` import that
 * fails halfway through a large file must not leave the dataset in a
 * partially-imported state either.
 *
 * **`confirmedReplaceAll` is enforced here, not only gated in the UI.**
 * M8-044's DoD is a guarantee about the Service's own behavior, not just
 * about what a well-behaved caller does — `applyImport` refuses to run
 * `replaceAll` at all without it, regardless of what `app/settings/page.tsx`
 * does or doesn't check first.
 */
import type { MappingResult } from '@/services/shared';
import { createApplicationError } from '@/services/shared';

import {
  createEnvelope,
  PERSISTED_RECORD_TYPES,
  type PersistedRecordType,
  type PersistenceService,
  persistenceService,
  type StorageEnvelope,
} from '../persistence';
import type { ImportValidationIssue } from './ImportValidator';
import { planRecordAction } from './preview';
import type { ImportApplyResult, ImportRecordPlan, MergeMode } from './types';

type Snapshot = Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>;

async function snapshotEverything(service: PersistenceService): Promise<MappingResult<Snapshot>> {
  const snapshot: Snapshot = {};
  for (const recordType of PERSISTED_RECORD_TYPES) {
    const listed = await service.listEnvelopes<unknown>(recordType);
    if (!listed.ok) return listed;
    if (listed.data.length > 0) snapshot[recordType] = listed.data;
  }
  return { ok: true, data: snapshot };
}

async function restore(service: PersistenceService, snapshot: Snapshot): Promise<void> {
  await service.clear();
  for (const recordType of PERSISTED_RECORD_TYPES) {
    const envelopes = snapshot[recordType];
    if (envelopes !== undefined && envelopes.length > 0) {
      await service.bulkWrite(recordType, envelopes);
    }
  }
}

/**
 * `addAsNew` regenerates the envelope's own `recordId` under a fresh id
 * — and, since a saved record's payload often carries its own `id`
 * field mirroring the envelope id (the same convention
 * `SavedLoopStrategy`/`SavedExitPlan`/`SavedSimulation` all follow), also
 * patches that field structurally so the two never drift apart. Read
 * generically as `Record<string, unknown>` — never a Store-owned type,
 * same discipline as `JsonExporter.ts`'s own `extractPortfolioId`.
 */
function withFreshId(
  recordType: PersistedRecordType,
  envelope: StorageEnvelope<unknown>,
  now: () => string,
): StorageEnvelope<unknown> {
  const freshId = crypto.randomUUID();
  const payload =
    typeof envelope.payload === 'object' && envelope.payload !== null
      ? { ...(envelope.payload as Record<string, unknown>), id: freshId }
      : envelope.payload;

  return createEnvelope(recordType, freshId, payload, { now });
}

export interface ApplyImportOptions {
  service?: PersistenceService;
  selectedRecordIds?: ReadonlySet<string>;
  confirmedReplaceAll?: boolean;
  now?: () => string;
}

export async function applyImport(
  validRecordsByType: Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>,
  mergeMode: MergeMode,
  issues: ImportValidationIssue[],
  options: ApplyImportOptions = {},
): Promise<MappingResult<ImportApplyResult>> {
  const service = options.service ?? persistenceService;
  const now = options.now ?? (() => new Date().toISOString());

  if (mergeMode === 'replaceAll' && options.confirmedReplaceAll !== true) {
    return {
      ok: false,
      errors: [
        createApplicationError(
          'import',
          'REPLACE_ALL_NOT_CONFIRMED',
          'Replacing all local data requires explicit confirmation before it can proceed.',
        ),
      ],
    };
  }

  const snapshotResult = await snapshotEverything(service);
  if (!snapshotResult.ok) return snapshotResult;
  const snapshot = snapshotResult.data;

  const existingIdsByType: Partial<Record<PersistedRecordType, ReadonlySet<string>>> = {};
  for (const recordType of PERSISTED_RECORD_TYPES) {
    existingIdsByType[recordType] = new Set((snapshot[recordType] ?? []).map((e) => e.recordId));
  }

  const written: ImportRecordPlan[] = [];
  const skipped: ImportRecordPlan[] = [];

  if (mergeMode === 'replaceAll') {
    const cleared = await service.clear();
    if (!cleared.ok) {
      await restore(service, snapshot);
      return cleared;
    }
  }

  for (const [recordType, envelopes] of Object.entries(validRecordsByType) as [
    PersistedRecordType,
    StorageEnvelope<unknown>[],
  ][]) {
    const existingIds = existingIdsByType[recordType] ?? new Set<string>();
    const toWrite: StorageEnvelope<unknown>[] = [];

    for (const envelope of envelopes) {
      const plan = planRecordAction(
        recordType,
        envelope.recordId,
        mergeMode === 'replaceAll' ? new Set<string>() : existingIds,
        mergeMode,
        options.selectedRecordIds,
      );

      if (plan.action === 'skip') {
        skipped.push(plan);
        continue;
      }

      const toPersist =
        plan.action === 'addAsNew' ? withFreshId(recordType, envelope, now) : envelope;
      toWrite.push(toPersist);
      written.push({ ...plan, recordId: toPersist.recordId });
    }

    if (toWrite.length > 0) {
      const bulkWritten = await service.bulkWrite(recordType, toWrite);
      if (!bulkWritten.ok) {
        await restore(service, snapshot);
        return bulkWritten;
      }
    }
  }

  for (const recordType of PERSISTED_RECORD_TYPES) {
    const verified = await service.list(recordType);
    if (!verified.ok) {
      await restore(service, snapshot);
      return verified;
    }
  }

  return {
    ok: true,
    data: {
      written,
      skipped,
      warnings: issues.filter((i) => i.code === 'DUPLICATE_RECORD_ID').map((i) => i.message),
      unsupportedRecords: issues
        .filter((i) => i.code !== 'DUPLICATE_RECORD_ID')
        .map((i) => i.message),
    },
  };
}
