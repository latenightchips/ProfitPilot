/**
 * Automatic Local Recovery Snapshot — 06_TASKS.md M8-046 ("Implement
 * Automatic Local Recovery Snapshot"). Dependencies: M8-011. "Create
 * before: Major migration, Large import, Full replacement, Conflict
 * resolution, Bulk deletion." Requirements: "Limit retained snapshots.
 * Avoid excessive storage use." DoD: "Recent valid data can be restored
 * after high-risk persistence operations."
 *
 * **Every snapshot is itself a real `'recoverySnapshot'` record, written
 * through `PersistenceService` like everything else** — not a second,
 * parallel storage mechanism. `createRecoverySnapshot` is called by
 * `services/import/apply.ts` (large import / full replacement / conflict
 * resolution) and `./clearLocalData.ts` (bulk deletion) as an
 * unconditional precondition step, separate from and persisted
 * regardless of whether the operation that follows it succeeds — the
 * same "always-committed, not part of the transactional rollback"
 * property those two callers' own header comments describe.
 *
 * **Not integrated into `./migrations/localDataMigration.ts` ("Major
 * migration")** — a deliberate, documented scope narrowing. That
 * function operates one layer lower, directly against a
 * `PersistenceAdapter` (not a `PersistenceService`), before this
 * application's persistence layer is fully bootstrapped; wiring a
 * `PersistenceService`-based snapshot into it would mean either
 * inverting that layering or duplicating this module's logic at the
 * adapter level for a trigger that — per that file's own header comment
 * — has never fired in production (`STORAGE_SCHEMA_VERSION` is `'1.0.0'`,
 * this application's first-ever version). Revisit when a second schema
 * version actually ships and a real migration path exists to protect.
 *
 * **`service.clear()` wipes every record type, including
 * `'recoverySnapshot'` itself.** Any caller that creates a snapshot and
 * then calls `clear()` (`./clearLocalData.ts`, `services/import/apply.ts`'s
 * `replaceAll` mode) must re-persist the returned envelope afterward via
 * `service.bulkWrite('recoverySnapshot', [envelope])` — see those files'
 * own comments for why. This module does not do that itself, since not
 * every caller clears storage immediately after snapshotting.
 */
import type { MappingResult } from '@/services/shared';
import { createApplicationError } from '@/services/shared';

import type { PersistenceService } from './persistence.service';
import { persistenceService } from './persistence.service';
import type {
  PersistedRecordType,
  PersistedRecoverySnapshot,
  RecoverySnapshotReason,
  StorageEnvelope,
} from './types';
import { PERSISTED_RECORD_TYPES } from './types';
import { EXPORTABLE_RECORD_TYPES } from './types/envelope';

/** M8-046's own "Limit retained snapshots" — oldest pruned once exceeded. */
export const MAX_RETAINED_RECOVERY_SNAPSHOTS = 5;

export interface RecoverySnapshotOptions {
  service?: PersistenceService;
  now?: () => string;
}

export async function createRecoverySnapshot(
  reason: RecoverySnapshotReason,
  options: RecoverySnapshotOptions = {},
): Promise<MappingResult<StorageEnvelope<PersistedRecoverySnapshot>>> {
  const service = options.service ?? persistenceService;
  const now = options.now ?? (() => new Date().toISOString());

  const records: PersistedRecoverySnapshot['records'] = {};
  for (const recordType of EXPORTABLE_RECORD_TYPES) {
    const listed = await service.listEnvelopes<unknown>(recordType);
    if (!listed.ok) return listed;
    if (listed.data.length > 0) records[recordType] = listed.data;
  }

  const payload: PersistedRecoverySnapshot = { reason, createdAt: now(), records };
  const written = await service.write('recoverySnapshot', crypto.randomUUID(), payload);
  if (!written.ok) return written;

  await pruneRecoverySnapshots(service);
  return written;
}

/**
 * Most-recent-first — the order a "Restore" list should present them in.
 * Sorted by the payload's own `createdAt` (set from this module's `now`
 * option), not the envelope's — `PersistenceService.write` always stamps
 * the envelope with real wall-clock time and has no way to override it,
 * so the payload's own field is the only reliably test-controllable and
 * semantically-precise "when was this snapshot taken" value.
 */
export async function listRecoverySnapshots(
  service: PersistenceService = persistenceService,
): Promise<MappingResult<StorageEnvelope<PersistedRecoverySnapshot>[]>> {
  const listed = await service.listEnvelopes<PersistedRecoverySnapshot>('recoverySnapshot');
  if (!listed.ok) return listed;
  return {
    ok: true,
    data: [...listed.data].sort((a, b) => b.payload.createdAt.localeCompare(a.payload.createdAt)),
  };
}

async function pruneRecoverySnapshots(service: PersistenceService): Promise<void> {
  const listed = await listRecoverySnapshots(service);
  if (!listed.ok) return;
  const excess = listed.data.slice(MAX_RETAINED_RECOVERY_SNAPSHOTS);
  for (const snapshot of excess) {
    await service.delete('recoverySnapshot', snapshot.recordId);
  }
}

type FullDatasetBackup = Partial<Record<PersistedRecordType, StorageEnvelope<unknown>[]>>;

async function snapshotWholeDataset(
  service: PersistenceService,
): Promise<MappingResult<FullDatasetBackup>> {
  const backup: FullDatasetBackup = {};
  for (const recordType of PERSISTED_RECORD_TYPES) {
    const listed = await service.listEnvelopes<unknown>(recordType);
    if (!listed.ok) return listed;
    if (listed.data.length > 0) backup[recordType] = listed.data;
  }
  return { ok: true, data: backup };
}

async function restoreWholeDataset(
  service: PersistenceService,
  backup: FullDatasetBackup,
): Promise<void> {
  await service.clear();
  for (const recordType of PERSISTED_RECORD_TYPES) {
    const envelopes = backup[recordType];
    if (envelopes !== undefined && envelopes.length > 0) {
      await service.bulkWrite(recordType, envelopes);
    }
  }
}

/**
 * Restores a snapshot's own point-in-time data over the current dataset.
 * Transactionally safe the same way `services/import/apply.ts`'s
 * `applyImport` is: the *current* state (including any other retained
 * recovery snapshots) is backed up in memory first and restored on any
 * failure partway through — restoring is itself a full replacement plus
 * bulk deletion of everything not in the target snapshot, the same
 * high-risk shape M8-046 exists to protect against in the first place.
 *
 * Deliberately does not restore the current dataset's own
 * `'recoverySnapshot'` records afterward — a restore ends with exactly
 * the business data the target snapshot held, not a merge of two
 * snapshot histories. This matches M8-046's own "Recent valid data can
 * be restored," not "recovery history is preserved forever."
 */
export async function restoreRecoverySnapshot(
  snapshotId: string,
  service: PersistenceService = persistenceService,
): Promise<MappingResult<void>> {
  const listed = await service.listEnvelopes<PersistedRecoverySnapshot>('recoverySnapshot');
  if (!listed.ok) return listed;

  const target = listed.data.find((entry) => entry.recordId === snapshotId);
  if (target === undefined) {
    return {
      ok: false,
      errors: [
        createApplicationError(
          'persistence',
          'RECOVERY_SNAPSHOT_NOT_FOUND',
          `No recovery snapshot exists with id "${snapshotId}".`,
        ),
      ],
    };
  }

  const currentBackup = await snapshotWholeDataset(service);
  if (!currentBackup.ok) return currentBackup;

  const cleared = await service.clear();
  if (!cleared.ok) {
    await restoreWholeDataset(service, currentBackup.data);
    return cleared;
  }

  for (const recordType of EXPORTABLE_RECORD_TYPES) {
    const envelopes = target.payload.records[recordType];
    if (envelopes !== undefined && envelopes.length > 0) {
      const written = await service.bulkWrite(recordType, envelopes);
      if (!written.ok) {
        await restoreWholeDataset(service, currentBackup.data);
        return written;
      }
    }
  }

  return { ok: true, data: undefined };
}
