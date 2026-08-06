/**
 * Synchronization Model — 06_TASKS.md M8-026 ("Create Synchronization
 * Model"). DoD: "Each synchronized record has enough metadata for
 * deterministic conflict handling."
 *
 * **A model, not a Service — pure functions only, zero network, zero
 * Supabase.** Every function below takes a `PersistedSyncMetadata` (and,
 * where relevant, a fact the caller already knows — "the local record
 * just changed," "the cloud reported this timestamp") and returns a new
 * `PersistedSyncMetadata`, deterministically, with no I/O.
 *
 * **Retained as a generic domain model under Milestone 8's local-only
 * re-scope** (product decision — see `docs/MILESTONE_8_SCOPE_CHANGE.md`).
 * Cloud Database and Cloud Synchronization are cancelled — there is no
 * real upload/download/queue logic that will ever call these functions
 * with real cloud data, and no Sync Service exists or will be built. The
 * model stays because it is genuinely generic: pure change/conflict
 * tracking over any two timestamped copies of a record, with no
 * Supabase dependency, independently useful and independently tested.
 *
 * **Deterministic conflict detection, explained**: a conflict exists
 * exactly when both the local copy and the "other" copy have changed
 * since the last time this record was successfully reconciled — every
 * transition function below derives `conflictStatus`/`syncStatus` from
 * that one rule, applied consistently, rather than each call site
 * inventing its own comparison — the same "one choke point, not
 * scattered logic" discipline this codebase's persistence layer already
 * follows elsewhere (`validatePersistedRecord` is the analogous choke
 * point for schema validation).
 *
 * A record that has never been synced (`lastSyncedAt === null`) is never
 * reported as `'conflict'` here — detecting a conflict requires an
 * "after the last sync" baseline to compare against, which doesn't exist
 * yet for a brand-new record. Reconciling a state where two independent
 * copies already exist with no shared baseline at all is a coarser,
 * one-time decision distinct from this per-record, post-baseline
 * conflict check.
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
 * Call once the "other" copy's own `updated_at` becomes known by
 * whatever means — this function does not fetch anything itself.
 */
export function markCloudChange(
  metadata: PersistedSyncMetadata,
  cloudUpdatedAt: string,
): PersistedSyncMetadata {
  const updated = { ...metadata, cloudUpdatedAt };
  return { ...updated, ...deriveStatus(updated) };
}

/**
 * Call once a successful push or pull completes for this record. Resets
 * the baseline (`lastSyncedAt`), assumes the "other" copy now reflects
 * exactly what was just synced (`cloudUpdatedAt` set to the same
 * timestamp), and clears any conflict — a successful sync is
 * definitionally a reconciliation.
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
 * Call when a sync attempt for this record fails (a network error, an
 * ownership denial, a validation rejection at the reconciliation
 * boundary) — distinct from `'pendingUpload'`/`'pendingDownload'`
 * because "needs to sync" and "just failed to sync" are different, both
 * user-visible states. Does not touch `conflictStatus` — a failure is
 * not itself a conflict.
 */
export function markSyncFailed(metadata: PersistedSyncMetadata): PersistedSyncMetadata {
  return { ...metadata, syncStatus: 'error' };
}

/**
 * Call once a user or a deterministic rule resolves a detected
 * conflict. Deliberately does not reset `syncStatus` to
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
