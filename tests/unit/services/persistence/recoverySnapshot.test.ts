import { describe, expect, it } from 'vitest';

import { createMemoryAdapter } from '@/services/persistence/adapters';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import {
  createRecoverySnapshot,
  listRecoverySnapshots,
  MAX_RETAINED_RECOVERY_SNAPSHOTS,
  restoreRecoverySnapshot,
} from '@/services/persistence/recoverySnapshot';
import type { PersistedRecordType, PersistenceAdapter } from '@/services/persistence/types';

function strategyPayload(id: string) {
  return {
    id,
    name: 'Strategy',
    portfolioId: 'p1',
    portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    settings: {},
    result: {},
    warnings: [],
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('createRecoverySnapshot', () => {
  it('captures every populated record type except recoverySnapshot itself', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1'));

    const result = await createRecoverySnapshot('bulk-deletion', { service });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.recordType).toBe('recoverySnapshot');
    expect(result.data.payload.reason).toBe('bulk-deletion');
    expect(result.data.payload.records.loopStrategy).toHaveLength(1);
    expect(result.data.payload.records.recoverySnapshot).toBeUndefined();
  });

  it('produces an empty records map for a fresh install', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await createRecoverySnapshot('bulk-deletion', { service });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload.records).toEqual({});
  });

  it('prunes the oldest snapshot once more than the retained maximum exist', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    let tick = 0;
    const now = () => `2026-01-01T00:00:${String(tick++).padStart(2, '0')}.000Z`;

    for (let i = 0; i < MAX_RETAINED_RECOVERY_SNAPSHOTS + 2; i += 1) {
      const created = await createRecoverySnapshot('bulk-deletion', { service, now });
      expect(created.ok).toBe(true);
    }

    const listed = await listRecoverySnapshots(service);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(MAX_RETAINED_RECOVERY_SNAPSHOTS);
  });
});

describe('listRecoverySnapshots', () => {
  it('returns snapshots most-recent-first', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await createRecoverySnapshot('migration', { service, now: () => '2026-01-01T00:00:00.000Z' });
    await createRecoverySnapshot('bulk-deletion', {
      service,
      now: () => '2026-02-01T00:00:00.000Z',
    });

    const listed = await listRecoverySnapshots(service);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data.map((s) => s.payload.reason)).toEqual(['bulk-deletion', 'migration']);
  });
});

describe('restoreRecoverySnapshot', () => {
  it('replaces the current dataset with the snapshot contents', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'original', strategyPayload('original'));
    const snapshot = await createRecoverySnapshot('bulk-deletion', { service });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;

    await service.write('loopStrategy', 'added-after-snapshot', strategyPayload('added-after'));

    const restored = await restoreRecoverySnapshot(snapshot.data.recordId, service);
    expect(restored.ok).toBe(true);

    const list = await service.list<{ id: string }>('loopStrategy');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((s) => s.id)).toEqual(['original']);
  });

  it('does not restore other recovery snapshots afterward', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const first = await createRecoverySnapshot('migration', { service });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = await createRecoverySnapshot('bulk-deletion', { service });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const restored = await restoreRecoverySnapshot(first.data.recordId, service);
    expect(restored.ok).toBe(true);

    const listed = await listRecoverySnapshots(service);
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.data).toHaveLength(0);
  });

  it('fails when the requested snapshot does not exist', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await restoreRecoverySnapshot('missing-id', service);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('RECOVERY_SNAPSHOT_NOT_FOUND');
  });

  it('rolls back to the current state when the restore write fails partway through', async () => {
    const real = createMemoryAdapter();
    let bulkWriteCalls = 0;
    const failingAdapter: PersistenceAdapter = {
      ...real,
      bulkWrite: async (recordType: PersistedRecordType, envelopes: unknown) => {
        bulkWriteCalls += 1;
        if (bulkWriteCalls === 1) {
          return {
            ok: false as const,
            errors: [
              {
                category: 'persistence' as const,
                code: 'SIMULATED_FAILURE',
                message: 'Simulated failure.',
              },
            ],
          };
        }
        return real.bulkWrite(recordType, envelopes as never);
      },
    };
    const service = createPersistenceService(failingAdapter);
    await service.write('loopStrategy', 'original', strategyPayload('original'));
    const snapshot = await createRecoverySnapshot('bulk-deletion', { service });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;

    const restored = await restoreRecoverySnapshot(snapshot.data.recordId, service);
    expect(restored.ok).toBe(false);

    const list = await service.list<{ id: string }>('loopStrategy');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((s) => s.id)).toEqual(['original']);
  });

  it('rolls back when clear() itself fails during a restore', async () => {
    const real = createMemoryAdapter();
    const failure = {
      ok: false as const,
      errors: [
        {
          category: 'persistence' as const,
          code: 'SIMULATED_FAILURE',
          message: 'Simulated failure.',
        },
      ],
    };
    let clearCalls = 0;
    const failingAdapter: PersistenceAdapter = {
      ...real,
      clear: async () => {
        clearCalls += 1;
        if (clearCalls === 1) return failure;
        return real.clear();
      },
    };
    const service = createPersistenceService(failingAdapter);
    await service.write('loopStrategy', 'original', strategyPayload('original'));
    const snapshot = await createRecoverySnapshot('bulk-deletion', { service });
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;

    const restored = await restoreRecoverySnapshot(snapshot.data.recordId, service);
    expect(restored.ok).toBe(false);

    const list = await service.list<{ id: string }>('loopStrategy');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((s) => s.id)).toEqual(['original']);
  });
});
