/**
 * Synchronization Model — 06_TASKS.md M8-026 ("Create Synchronization
 * Model"). DoD: "Each synchronized record has enough metadata for
 * deterministic conflict handling."
 *
 * **A model, not a Service — pure functions only, zero network, zero
 * Supabase.** Every function below takes a `PersistedSyncMetadata` (and,
 * where relevant, a fact the caller already knows — "the local record
 * just changed," "the cloud reported this timestamp") and returns a new
 * `PersistedSyncMetadata`, deterministically, with no I/O. This is
 * exactly the kind of "prepare the model before the infrastructure that
 * consumes it" work `docs/CLOUD_READINESS.md` §9 flagged as safely
 * buildable without Supabase credentials — real upload/download/queue
 * logic (M8-027 onward) is what will eventually *call* these functions
 * with real data; nothing here reaches out to fetch or push anything
 * itself. `./sync.service.ts` stays an intentionally empty stub.
 *
 * **Deterministic conflict detection, explained**: a conflict exists
 * exactly when both the local copy and the cloud copy have changed since
 * the last time this record was successfully synced — M8-031's own
 * definition ("Detect when the same record changed locally and remotely
 * after the last sync"). Every transition function below derives
 * `conflictStatus`/`syncStatus` from that one rule, applied consistently,
 * rather than each call site inventing its own comparison — the same
 * "one choke point, not scattered logic" discipline this codebase's
 * persistence layer already follows elsewhere (`validatePersistedRecord`
 * is the analogous choke point for schema validation).
 *
 * A record that has never been synced (`lastSyncedAt === null`) is never
 * reported as `'conflict'` here — M8-031's own definition requires an
 * "after the last sync" baseline to compare against, which doesn't exist
 * yet for a brand-new record. Reconciling a *first* sync where local and
 * cloud both already have independent data is M8-027's own "First
 * Sign-In Data Merge" concern (its "Local data only / Cloud data only /
 * Both local and cloud data / No data" states), a coarser one-time
 * decision distinct from this per-record, post-baseline conflict check.
 */
import type { PersistedRecordType } from './types/envelope';
import type { PersistedSyncMetadata } from './types/models';

/**
 * The initial state for a record that has never been synced —
 * `syncStatus: 'pendingUpload'` since a brand-new local record always
 * needs an initial push once sync is available; `conflictStatus: 'none'`
 * since there is no baseline yet for a conflict to be detected against.
 */
export function createSyncMetadata(
  recordType: PersistedRecordType,
  recordId: string,
  originDeviceId: string,
  now: string,
): PersistedSyncMetadata {
  return {
    recordType,
    recordId,
    localUpdatedAt: now,
    cloudUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: 'pendingUpload',
    originDeviceId,
    deletionMarker: null,
    conflictStatus: 'none',
  };
}

function hasChangedSinceSync(timestamp: string | null, lastSyncedAt: string | null): boolean {
  if (lastSyncedAt === null) return timestamp !== null;
  return timestamp !== null && timestamp > lastSyncedAt;
}

/**
 * Re-derives `syncStatus`/`conflictStatus` from the current
 * `localUpdatedAt`/`cloudUpdatedAt`/`lastSyncedAt` triple — the one place
 * every transition function below funnels through, so the "both sides
 * changed since last sync" rule is applied exactly once.
 */
function deriveStatus(
  metadata: PersistedSyncMetadata,
): Pick<PersistedSyncMetadata, 'syncStatus' | 'conflictStatus'> {
  const localChanged = hasChangedSinceSync(metadata.localUpdatedAt, metadata.lastSyncedAt);
  const cloudChanged = hasChangedSinceSync(metadata.cloudUpdatedAt, metadata.lastSyncedAt);
  const isConflict = metadata.lastSyncedAt !== null && localChanged && cloudChanged;

  if (isConflict) {
    return { syncStatus: 'conflict', conflictStatus: 'detected' };
  }
  if (localChanged) {
    return { syncStatus: 'pendingUpload', conflictStatus: metadata.conflictStatus };
  }
  if (cloudChanged) {
    return { syncStatus: 'pendingDownload', conflictStatus: metadata.conflictStatus };
  }
  return { syncStatus: 'synced', conflictStatus: metadata.conflictStatus };
}

/**
 * Call after the local application record this entry describes changes
 * (a Store write, an import, a user edit) — see `../types/models.ts`'s
 * own header comment for why this mirroring is not automatic.
 */
export function markLocalChange(
  metadata: PersistedSyncMetadata,
  now: string,
): PersistedSyncMetadata {
  const updated = { ...metadata, localUpdatedAt: now };
  return { ...updated, ...deriveStatus(updated) };
}

/**
 * A local deletion is modeled as a local change (it needs to propagate
 * through sync the same as an edit) that additionally sets the tombstone
 * marker — see `PersistedSyncMetadata.deletionMarker`'s own comment.
 */
export function markLocalDeletion(
  metadata: PersistedSyncMetadata,
  now: string,
): PersistedSyncMetadata {
  return { ...markLocalChange(metadata, now), deletionMarker: now };
}

/**
 * Call once a future Sync Service learns the cloud copy's own
 * `updated_at` (a poll, a realtime event, or the response to an upload) —
 * this function does not fetch anything itself.
 */
export function markCloudChange(
  metadata: PersistedSyncMetadata,
  cloudUpdatedAt: string,
): PersistedSyncMetadata {
  const updated = { ...metadata, cloudUpdatedAt };
  return { ...updated, ...deriveStatus(updated) };
}

/**
 * Call once a future Sync Service completes a successful push or pull
 * for this record. Resets the baseline (`lastSyncedAt`), assumes the
 * cloud now reflects exactly what was just synced (`cloudUpdatedAt` set
 * to the same timestamp — the server is expected to stamp its own
 * `updated_at` at write time, matching `syncedAt`), and clears any
 * conflict — a successful sync is definitionally a reconciliation.
 */
export function markSynced(
  metadata: PersistedSyncMetadata,
  syncedAt: string,
): PersistedSyncMetadata {
  return {
    ...metadata,
    lastSyncedAt: syncedAt,
    cloudUpdatedAt: syncedAt,
    syncStatus: 'synced',
    conflictStatus: 'none',
  };
}

/**
 * Call when a sync attempt for this record fails (network error, a real
 * RLS denial, a validation rejection at the cloud boundary) — distinct
 * from `'pendingUpload'`/`'pendingDownload'` because "needs to sync" and
 * "just failed to sync" are different, both user-visible states
 * (M8-034's future "Failed" status). Does not touch `conflictStatus` — a
 * failure is not itself a conflict.
 */
export function markSyncFailed(metadata: PersistedSyncMetadata): PersistedSyncMetadata {
  return { ...metadata, syncStatus: 'error' };
}

/**
 * Call once a user (M8-032, unbuilt) or a deterministic rule resolves a
 * detected conflict. Deliberately does not reset `syncStatus` to
 * `'synced'` — the resolution still needs to actually be synced
 * (`markSynced`) before that's true; this only records that the
 * conflict itself has been dealt with, distinct from `'none'` so a
 * resolved-but-not-yet-re-synced record stays distinguishable from one
 * that was never in conflict.
 */
export function resolveConflict(metadata: PersistedSyncMetadata): PersistedSyncMetadata {
  return { ...metadata, conflictStatus: 'resolved' };
}

/** Exposed for callers that only need the pure classification rule without a full transition. */
export function isConflicted(metadata: PersistedSyncMetadata): boolean {
  return metadata.conflictStatus === 'detected';
}
