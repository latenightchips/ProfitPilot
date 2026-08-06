import { describe, expect, it } from 'vitest';

import {
  createSyncMetadata,
  isConflicted,
  markCloudChange,
  markLocalChange,
  markLocalDeletion,
  markSynced,
  markSyncFailed,
  resolveConflict,
} from '@/services/persistence/syncMetadataModel';
import type { PersistedSyncMetadata } from '@/services/persistence/types/models';

const DEVICE_ID = 'device-1';

describe('createSyncMetadata (M8-026)', () => {
  it('starts as pendingUpload with no conflict and no sync history', () => {
    const metadata = createSyncMetadata(
      'portfolio',
      'portfolio-1',
      DEVICE_ID,
      '2026-01-01T00:00:00.000Z',
    );
    expect(metadata).toEqual({
      recordType: 'portfolio',
      recordId: 'portfolio-1',
      localUpdatedAt: '2026-01-01T00:00:00.000Z',
      cloudUpdatedAt: null,
      lastSyncedAt: null,
      syncStatus: 'pendingUpload',
      originDeviceId: DEVICE_ID,
      deletionMarker: null,
      conflictStatus: 'none',
    });
  });
});

describe('markLocalChange', () => {
  it('updates localUpdatedAt and keeps pendingUpload for a never-synced record', () => {
    const initial = createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z');
    const changed = markLocalChange(initial, '2026-01-02T00:00:00.000Z');
    expect(changed.localUpdatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(changed.syncStatus).toBe('pendingUpload');
    expect(changed.conflictStatus).toBe('none');
  });

  it('reports conflict when the cloud also changed since the last sync', () => {
    const synced: PersistedSyncMetadata = {
      recordType: 'portfolio',
      recordId: 'p1',
      localUpdatedAt: '2026-01-01T00:00:00.000Z',
      cloudUpdatedAt: '2026-01-01T00:00:00.000Z',
      lastSyncedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: 'synced',
      originDeviceId: DEVICE_ID,
      deletionMarker: null,
      conflictStatus: 'none',
    };
    // Simulate the cloud having changed after the last sync, then the local copy changing too.
    const cloudChanged = markCloudChange(synced, '2026-01-02T00:00:00.000Z');
    const bothChanged = markLocalChange(cloudChanged, '2026-01-03T00:00:00.000Z');

    expect(bothChanged.syncStatus).toBe('conflict');
    expect(bothChanged.conflictStatus).toBe('detected');
    expect(isConflicted(bothChanged)).toBe(true);
  });

  it('does not report a conflict for a record that has never been synced, even with a stale cloudUpdatedAt-like field', () => {
    // A never-synced record has cloudUpdatedAt: null by construction, so
    // there is nothing for a local change to conflict with yet.
    const initial = createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z');
    const changed = markLocalChange(initial, '2026-01-02T00:00:00.000Z');
    expect(changed.conflictStatus).toBe('none');
    expect(changed.syncStatus).toBe('pendingUpload');
  });
});

describe('markLocalDeletion', () => {
  it('sets the deletion tombstone and behaves like a local change', () => {
    const initial = createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z');
    const deleted = markLocalDeletion(initial, '2026-01-02T00:00:00.000Z');
    expect(deleted.deletionMarker).toBe('2026-01-02T00:00:00.000Z');
    expect(deleted.localUpdatedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(deleted.syncStatus).toBe('pendingUpload');
  });
});

describe('markCloudChange', () => {
  it('reports pendingDownload when only the cloud changed since the last sync', () => {
    const synced = markSynced(
      createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z'),
      '2026-01-01T00:00:00.000Z',
    );
    const cloudChanged = markCloudChange(synced, '2026-01-02T00:00:00.000Z');
    expect(cloudChanged.syncStatus).toBe('pendingDownload');
    expect(cloudChanged.conflictStatus).toBe('none');
  });

  it('reports a conflict when both sides changed since the last sync', () => {
    const synced = markSynced(
      createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z'),
      '2026-01-01T00:00:00.000Z',
    );
    const localChanged = markLocalChange(synced, '2026-01-02T00:00:00.000Z');
    const bothChanged = markCloudChange(localChanged, '2026-01-03T00:00:00.000Z');
    expect(bothChanged.syncStatus).toBe('conflict');
    expect(bothChanged.conflictStatus).toBe('detected');
  });

  it('does not report a conflict on a never-synced record even once the cloud reports a timestamp', () => {
    const initial = createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z');
    const cloudChanged = markCloudChange(initial, '2026-01-02T00:00:00.000Z');
    expect(cloudChanged.conflictStatus).toBe('none');
    // Both sides have a value, but there is no prior sync baseline —
    // reconciling two independent copies with no shared history is a
    // coarser, one-time decision distinct from this per-record conflict check.
    expect(cloudChanged.syncStatus).not.toBe('conflict');
  });

  it('stays synced when a redundant cloud notification repeats a timestamp that is not newer than the last sync', () => {
    const synced = markSynced(
      createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z'),
      '2026-01-01T00:00:00.000Z',
    );
    const redundant = markCloudChange(synced, '2026-01-01T00:00:00.000Z');
    expect(redundant.syncStatus).toBe('synced');
    expect(redundant.conflictStatus).toBe('none');
  });
});

describe('markSynced', () => {
  it('resets the baseline, mirrors cloudUpdatedAt, and clears any conflict', () => {
    const synced = markSynced(
      createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z'),
      '2026-01-01T00:00:00.000Z',
    );
    const localChanged = markLocalChange(synced, '2026-01-02T00:00:00.000Z');
    const conflicted = markCloudChange(localChanged, '2026-01-03T00:00:00.000Z');
    expect(conflicted.syncStatus).toBe('conflict');

    const resynced = markSynced(conflicted, '2026-01-04T00:00:00.000Z');
    expect(resynced.lastSyncedAt).toBe('2026-01-04T00:00:00.000Z');
    expect(resynced.cloudUpdatedAt).toBe('2026-01-04T00:00:00.000Z');
    expect(resynced.syncStatus).toBe('synced');
    expect(resynced.conflictStatus).toBe('none');
  });
});

describe('markSyncFailed', () => {
  it('sets syncStatus to error without touching conflictStatus', () => {
    const initial = createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z');
    const failed = markSyncFailed(initial);
    expect(failed.syncStatus).toBe('error');
    expect(failed.conflictStatus).toBe('none');
  });

  it('preserves an existing detected conflict when a sync attempt on it fails', () => {
    const synced = markSynced(
      createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z'),
      '2026-01-01T00:00:00.000Z',
    );
    const localChanged = markLocalChange(synced, '2026-01-02T00:00:00.000Z');
    const conflicted = markCloudChange(localChanged, '2026-01-03T00:00:00.000Z');
    const failed = markSyncFailed(conflicted);
    expect(failed.syncStatus).toBe('error');
    expect(failed.conflictStatus).toBe('detected');
  });
});

describe('resolveConflict', () => {
  it('marks the conflict resolved without changing syncStatus until the next real sync', () => {
    const synced = markSynced(
      createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z'),
      '2026-01-01T00:00:00.000Z',
    );
    const localChanged = markLocalChange(synced, '2026-01-02T00:00:00.000Z');
    const conflicted = markCloudChange(localChanged, '2026-01-03T00:00:00.000Z');
    const resolved = resolveConflict(conflicted);

    expect(resolved.conflictStatus).toBe('resolved');
    expect(resolved.syncStatus).toBe('conflict');
    expect(isConflicted(resolved)).toBe(false);
  });

  it('a subsequent successful sync clears a resolved conflict back to none', () => {
    const synced = markSynced(
      createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z'),
      '2026-01-01T00:00:00.000Z',
    );
    const localChanged = markLocalChange(synced, '2026-01-02T00:00:00.000Z');
    const conflicted = markCloudChange(localChanged, '2026-01-03T00:00:00.000Z');
    const resolved = resolveConflict(conflicted);
    const resynced = markSynced(resolved, '2026-01-04T00:00:00.000Z');

    expect(resynced.conflictStatus).toBe('none');
    expect(resynced.syncStatus).toBe('synced');
  });
});

describe('isConflicted', () => {
  it('is true only for a detected conflict, not resolved or none', () => {
    const none = createSyncMetadata('portfolio', 'p1', DEVICE_ID, '2026-01-01T00:00:00.000Z');
    expect(isConflicted(none)).toBe(false);

    const synced = markSynced(none, '2026-01-01T00:00:00.000Z');
    const localChanged = markLocalChange(synced, '2026-01-02T00:00:00.000Z');
    const conflicted = markCloudChange(localChanged, '2026-01-03T00:00:00.000Z');
    expect(isConflicted(conflicted)).toBe(true);

    expect(isConflicted(resolveConflict(conflicted))).toBe(false);
  });
});
