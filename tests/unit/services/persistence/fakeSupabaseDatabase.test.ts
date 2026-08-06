import { describe, expect, it } from 'vitest';

import { FakeSupabaseDatabase } from '../../../fixtures/fakeSupabaseDatabase';

/**
 * Proves the fake itself behaves correctly before any future adapter
 * test relies on it — see `tests/fixtures/fakeSupabaseDatabase.ts`'s own
 * header comment for what this fixture is (and is explicitly not: a
 * substitute for real Row-Level Security verification).
 */
describe('FakeSupabaseDatabase', () => {
  it('denies every operation when no current user is set', async () => {
    const db = new FakeSupabaseDatabase(null);
    const selectResult = await db.selectByRecordId('portfolios', 'p1');
    expect(selectResult.error?.code).toBe('RLS_DENIED');

    const insertResult = await db.insert('portfolios', {
      userId: 'user-1',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: { name: 'Test' },
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(insertResult.error?.code).toBe('RLS_DENIED');
  });

  it('inserts and reads back a row owned by the current user', async () => {
    const db = new FakeSupabaseDatabase('user-1');
    const inserted = await db.insert('portfolios', {
      userId: 'user-1',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: { name: 'Test' },
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(inserted.error).toBeNull();
    expect(inserted.data?.recordId).toBe('p1');

    const read = await db.selectByRecordId('portfolios', 'p1');
    expect(read.error).toBeNull();
    expect(read.data?.payload).toEqual({ name: 'Test' });
  });

  it('rejects inserting a row for a different user than the current one', async () => {
    const db = new FakeSupabaseDatabase('user-1');
    const result = await db.insert('portfolios', {
      userId: 'user-2',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: {},
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(result.error?.code).toBe('RLS_DENIED');
  });

  it("never returns another user's row from selectByRecordId or selectAllOwned", async () => {
    const db = new FakeSupabaseDatabase('user-1');
    db.seedRow('portfolios', {
      userId: 'user-2',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: { name: "Someone else's portfolio" },
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const byId = await db.selectByRecordId('portfolios', 'p1');
    expect(byId.data).toBeNull();

    const all = await db.selectAllOwned('portfolios');
    expect(all.data).toHaveLength(0);
  });

  it('scopes selectAllOwned to only the current user across multiple owners', async () => {
    const db = new FakeSupabaseDatabase('user-1');
    db.seedRow('portfolios', {
      userId: 'user-1',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: {},
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    db.seedRow('portfolios', {
      userId: 'user-2',
      recordId: 'p2',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: {},
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const owned = await db.selectAllOwned('portfolios');
    expect(owned.data).toHaveLength(1);
    expect(owned.data[0]?.recordId).toBe('p1');
  });

  it('updates only a row owned by the current user', async () => {
    const db = new FakeSupabaseDatabase('user-1');
    db.seedRow('portfolios', {
      userId: 'user-1',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: { name: 'Old' },
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const updated = await db.update('portfolios', 'p1', { payload: { name: 'New' } });
    expect(updated.error).toBeNull();
    expect(updated.data?.payload).toEqual({ name: 'New' });
  });

  it("rejects updating another user's row", async () => {
    const db = new FakeSupabaseDatabase('user-1');
    db.seedRow('portfolios', {
      userId: 'user-2',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: {},
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const updated = await db.update('portfolios', 'p1', { payload: { name: 'Hacked' } });
    expect(updated.error?.code).toBe('RLS_DENIED');
  });

  it('deletes only a row owned by the current user', async () => {
    const db = new FakeSupabaseDatabase('user-1');
    db.seedRow('portfolios', {
      userId: 'user-1',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: {},
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const deleted = await db.delete('portfolios', 'p1');
    expect(deleted.error).toBeNull();

    const afterDelete = await db.selectByRecordId('portfolios', 'p1');
    expect(afterDelete.data).toBeNull();
  });

  it("rejects deleting another user's row", async () => {
    const db = new FakeSupabaseDatabase('user-1');
    db.seedRow('portfolios', {
      userId: 'user-2',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: {},
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    const deleted = await db.delete('portfolios', 'p1');
    expect(deleted.error?.code).toBe('RLS_DENIED');
  });

  it('forceNextError injects a one-time failure, then resumes normal behavior', async () => {
    const db = new FakeSupabaseDatabase('user-1');
    db.forceNextError({ message: 'Simulated network failure.', code: 'NETWORK_ERROR' });

    const failed = await db.selectAllOwned('portfolios');
    expect(failed.error?.code).toBe('NETWORK_ERROR');

    const succeeded = await db.selectAllOwned('portfolios');
    expect(succeeded.error).toBeNull();
  });

  it('setCurrentUser changes which rows are visible', async () => {
    const db = new FakeSupabaseDatabase('user-1');
    db.seedRow('portfolios', {
      userId: 'user-2',
      recordId: 'p1',
      storageSchemaVersion: '1.0.0',
      appVersion: '0.1.0',
      payload: {},
      checksum: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect((await db.selectAllOwned('portfolios')).data).toHaveLength(0);

    db.setCurrentUser('user-2');
    expect((await db.selectAllOwned('portfolios')).data).toHaveLength(1);
  });
});
