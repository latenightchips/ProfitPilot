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
 *
 * **`createRecoverySnapshot` (Milestone 8 Batch 4, M8-046) is a
 * separate, always-persisted precondition — not the same thing as
 * `snapshotEverything`/`restore` above.** That pair is an in-memory,
 * function-lifetime-only rollback mechanism (nothing is written to
 * storage; it only exists in a local variable while `applyImport` runs).
 * `createRecoverySnapshot` instead writes a real, durable
 * `'recoverySnapshot'` record the user can browse and restore later from
 * `app/settings/page.tsx`, satisfying M8-046's own "Create before...
 * Large import, Full replacement, Conflict resolution" list — it is
 * called, and must succeed, *before* the transactional snapshot below is
 * even taken, so that snapshot (and therefore any later rollback) also
 * protects the just-created recovery snapshot itself.
 */
import type { MappingResult } from '@/services/shared';
import { createApplicationError } from '@/services/shared';

import {
  createEnvelope,
  createRecoverySnapshot,
  PERSISTED_RECORD_TYPES,
  type PersistedRecordType,
  type PersistenceService,
  persistenceService,
  type RecoverySnapshotReason,
  type StorageEnvelope,
} from '../persistence';
import type { ImportValidationIssue } from './ImportValidator';
import { planRecordAction } from './preview';
import type { ImportApplyResult, ImportRecordPlan, MergeMode } from './types';

/** M8-046's own "Large import" trigger — a threshold, not an exact spec. */
const LARGE_IMPORT_RECORD_THRESHOLD = 20;

function countIncomingRecords(
  validRecordsByType: Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>,
): number {
  return Object.values(validRecordsByType).reduce(
    (total, envelopes) => total + envelopes.length,
    0,
  );
}

/**
 * Maps a merge mode (plus how much it would import) to M8-046's own
 * "Create before" list: `replaceAll` is always a "Full replacement",
 * `replaceSelected` only ever targets already-conflicting records so it
 * is always a "Conflict resolution", and `addAsNew`/`mergeNonConflicting`
 * only rise to "Large import" once the incoming record count crosses
 * `LARGE_IMPORT_RECORD_THRESHOLD` — a small addAsNew/merge import gets no
 * snapshot, matching "avoid excessive storage use."
 */
function determineRecoverySnapshotReason(
  mergeMode: MergeMode,
  incomingRecordCount: number,
): RecoverySnapshotReason | null {
  if (mergeMode === 'replaceAll') return 'full-replacement';
  if (mergeMode === 'replaceSelected') return 'conflict-resolution';
  if (incomingRecordCount > LARGE_IMPORT_RECORD_THRESHOLD) return 'large-import';
  return null;
}

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

  const recoverySnapshotReason = determineRecoverySnapshotReason(
    mergeMode,
    countIncomingRecords(validRecordsByType),
  );
  let recoverySnapshotEnvelope: StorageEnvelope<unknown> | null = null;
  if (recoverySnapshotReason !== null) {
    const recoverySnapshotResult = await createRecoverySnapshot(recoverySnapshotReason, {
      service,
      now,
    });
    if (!recoverySnapshotResult.ok) return recoverySnapshotResult;
    recoverySnapshotEnvelope = recoverySnapshotResult.data;
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

    // `clear()` above just wiped the recovery snapshot created moments
    // ago (it wipes every record type, including `'recoverySnapshot'`
    // itself) — re-persist it so M8-046's DoD ("Recent valid data can be
    // restored") holds even for the one merge mode that clears storage.
    if (recoverySnapshotEnvelope !== null) {
      const preserved = await service.bulkWrite('recoverySnapshot', [recoverySnapshotEnvelope]);
      if (!preserved.ok) {
        await restore(service, snapshot);
        return preserved;
      }
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
