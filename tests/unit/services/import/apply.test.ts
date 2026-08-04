import { describe, expect, it } from 'vitest';

import { applyImport } from '@/services/import/apply';
import { createMemoryAdapter } from '@/services/persistence/adapters';
import { createEnvelope } from '@/services/persistence/envelope';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import { listRecoverySnapshots } from '@/services/persistence/recoverySnapshot';
import type {
  PersistedRecordType,
  PersistenceAdapter,
  StorageEnvelope,
} from '@/services/persistence/types';

/**
 * Fails only the *first* `bulkWrite` call for `failOnRecordType` — the
 * one `applyImport` itself makes while writing new data — so that
 * `apply.ts`'s own `restore()` (which also calls `bulkWrite` for every
 * record type, including this one, while rolling back) can still
 * succeed. A double-failing adapter would make restoration itself
 * impossible to test, not exercise a real "roll back to the original
 * snapshot" path.
 */
function createFailingBulkWriteAdapter(failOnRecordType: PersistedRecordType): PersistenceAdapter {
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
  let hasFailedOnce = false;
  return {
    ...real,
    bulkWrite: async <T>(recordType: PersistedRecordType, envelopes: StorageEnvelope<T>[]) => {
      if (recordType === failOnRecordType && !hasFailedOnce) {
        hasFailedOnce = true;
        return failure;
      }
      return real.bulkWrite(recordType, envelopes);
    },
  };
}

function strategyPayload(id: string, portfolioId: string) {
  return {
    id,
    name: 'Strategy',
    portfolioId,
    portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    settings: {},
    result: {},
    warnings: [],
    metadata: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('applyImport — addAsNew', () => {
  it('writes the record under a freshly generated id and syncs the payload id field', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const envelope = createEnvelope(
      'loopStrategy',
      'strategy-1',
      strategyPayload('strategy-1', 'p1'),
    );

    const result = await applyImport({ loopStrategy: [envelope] }, 'addAsNew', [], { service });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.written).toHaveLength(1);
    const newId = result.data.written[0]?.recordId;
    expect(newId).not.toBe('strategy-1');

    const list = await service.list<{ id: string }>('loopStrategy');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(1);
    expect(list.data[0]?.id).toBe(newId);
  });
});

describe('applyImport — mergeNonConflicting', () => {
  it('adds a non-conflicting record and skips a conflicting one, leaving it untouched', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1', 'p1'));

    const conflictingEnvelope = createEnvelope(
      'loopStrategy',
      'strategy-1',
      strategyPayload('strategy-1', 'IMPORTED-SHOULD-NOT-APPLY'),
    );
    const nonConflictingEnvelope = createEnvelope(
      'loopStrategy',
      'strategy-2',
      strategyPayload('strategy-2', 'p1'),
    );

    const result = await applyImport(
      { loopStrategy: [conflictingEnvelope, nonConflictingEnvelope] },
      'mergeNonConflicting',
      [],
      { service },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.written.map((w) => w.recordId)).toEqual(['strategy-2']);
    expect(result.data.skipped.map((w) => w.recordId)).toEqual(['strategy-1']);

    const original = await service.read<{ portfolioId: string }>('loopStrategy', 'strategy-1');
    expect(original.ok).toBe(true);
    if (!original.ok) return;
    expect(original.data?.portfolioId).toBe('p1');
  });
});

describe('applyImport — replaceSelected', () => {
  it('replaces only the selected conflicting ids', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1', 'original-1'));
    await service.write('loopStrategy', 'strategy-2', strategyPayload('strategy-2', 'original-2'));

    const envelope1 = createEnvelope(
      'loopStrategy',
      'strategy-1',
      strategyPayload('strategy-1', 'replaced-1'),
    );
    const envelope2 = createEnvelope(
      'loopStrategy',
      'strategy-2',
      strategyPayload('strategy-2', 'replaced-2'),
    );

    const result = await applyImport(
      { loopStrategy: [envelope1, envelope2] },
      'replaceSelected',
      [],
      {
        service,
        selectedRecordIds: new Set(['strategy-1']),
      },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const one = await service.read<{ portfolioId: string }>('loopStrategy', 'strategy-1');
    const two = await service.read<{ portfolioId: string }>('loopStrategy', 'strategy-2');
    expect(one.ok && one.data?.portfolioId).toBe('replaced-1');
    expect(two.ok && two.data?.portfolioId).toBe('original-2');
  });
});

describe('applyImport — replaceAll', () => {
  it('rejects without explicit confirmation and writes nothing', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1', 'p1'));

    const envelope = createEnvelope(
      'loopStrategy',
      'strategy-2',
      strategyPayload('strategy-2', 'p1'),
    );
    const result = await applyImport({ loopStrategy: [envelope] }, 'replaceAll', [], { service });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('REPLACE_ALL_NOT_CONFIRMED');

    const list = await service.list('loopStrategy');
    expect(list.ok && list.data).toHaveLength(1);
  });

  it('clears all local data and writes only the file contents once confirmed', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1', 'p1'));

    const envelope = createEnvelope(
      'loopStrategy',
      'strategy-2',
      strategyPayload('strategy-2', 'p1'),
    );
    const result = await applyImport({ loopStrategy: [envelope] }, 'replaceAll', [], {
      service,
      confirmedReplaceAll: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const list = await service.list<{ id: string }>('loopStrategy');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(1);
    expect(list.data[0]?.id).toBe('strategy-2');
  });

  it('rolls back when clear() itself fails', async () => {
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
    await service.write('loopStrategy', 'existing', strategyPayload('existing', 'p1'));

    const envelope = createEnvelope(
      'loopStrategy',
      'strategy-2',
      strategyPayload('strategy-2', 'p1'),
    );
    const result = await applyImport({ loopStrategy: [envelope] }, 'replaceAll', [], {
      service,
      confirmedReplaceAll: true,
    });
    expect(result.ok).toBe(false);

    const list = await service.list<{ id: string }>('loopStrategy');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((s) => s.id)).toEqual(['existing']);
  });
});

describe('applyImport — rollback on failure', () => {
  it('restores the original dataset when a bulkWrite fails', async () => {
    const adapter = createFailingBulkWriteAdapter('loopStrategy');
    const service = createPersistenceService(adapter);
    await service.write('loopStrategy', 'existing', strategyPayload('existing', 'p1'));

    const envelope = createEnvelope(
      'loopStrategy',
      'strategy-2',
      strategyPayload('strategy-2', 'p1'),
    );
    const result = await applyImport({ loopStrategy: [envelope] }, 'mergeNonConflicting', [], {
      service,
    });
    expect(result.ok).toBe(false);

    const list = await service.list<{ id: string }>('loopStrategy');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data).toHaveLength(1);
    expect(list.data[0]?.id).toBe('existing');
  });

  it('restores pre-existing data across all record types even when a later type fails', async () => {
    const adapter = createFailingBulkWriteAdapter('exitPlan');
    const service = createPersistenceService(adapter);
    await service.write(
      'loopStrategy',
      'existing-strategy',
      strategyPayload('existing-strategy', 'p1'),
    );

    const strategyEnvelope = createEnvelope(
      'loopStrategy',
      'new-strategy',
      strategyPayload('new-strategy', 'p1'),
    );
    const exitPlanEnvelope = createEnvelope('exitPlan', 'new-plan', {
      id: 'new-plan',
      name: 'Plan',
      portfolioId: 'p1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
      exitType: 'fullExit',
      targetInputs: {},
      result: {},
      warnings: [],
      metadata: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    const result = await applyImport(
      { loopStrategy: [strategyEnvelope], exitPlan: [exitPlanEnvelope] },
      'mergeNonConflicting',
      [],
      { service },
    );
    expect(result.ok).toBe(false);

    const strategies = await service.list<{ id: string }>('loopStrategy');
    const plans = await service.list('exitPlan');
    expect(strategies.ok && strategies.data).toHaveLength(1);
    expect(strategies.ok && strategies.data[0]?.id).toBe('existing-strategy');
    expect(plans.ok && plans.data).toHaveLength(0);
  });
});

describe('applyImport — recovery snapshot integration (M8-046)', () => {
  it('creates a full-replacement recovery snapshot before replaceAll, which survives the clear', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1', 'p1'));

    const envelope = createEnvelope(
      'loopStrategy',
      'strategy-2',
      strategyPayload('strategy-2', 'p1'),
    );
    const result = await applyImport({ loopStrategy: [envelope] }, 'replaceAll', [], {
      service,
      confirmedReplaceAll: true,
    });
    expect(result.ok).toBe(true);

    const snapshots = await listRecoverySnapshots(service);
    expect(snapshots.ok).toBe(true);
    if (!snapshots.ok) return;
    expect(snapshots.data).toHaveLength(1);
    expect(snapshots.data[0]?.payload.reason).toBe('full-replacement');
    expect(snapshots.data[0]?.payload.records.loopStrategy?.[0]?.recordId).toBe('strategy-1');
  });

  it('creates a conflict-resolution recovery snapshot before replaceSelected', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1', 'original'));

    const envelope = createEnvelope(
      'loopStrategy',
      'strategy-1',
      strategyPayload('strategy-1', 'replaced'),
    );
    const result = await applyImport({ loopStrategy: [envelope] }, 'replaceSelected', [], {
      service,
      selectedRecordIds: new Set(['strategy-1']),
    });
    expect(result.ok).toBe(true);

    const snapshots = await listRecoverySnapshots(service);
    expect(snapshots.ok).toBe(true);
    if (!snapshots.ok) return;
    expect(snapshots.data).toHaveLength(1);
    expect(snapshots.data[0]?.payload.reason).toBe('conflict-resolution');
  });

  it('does not create a recovery snapshot for a small addAsNew/mergeNonConflicting import', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const envelope = createEnvelope(
      'loopStrategy',
      'strategy-1',
      strategyPayload('strategy-1', 'p1'),
    );

    await applyImport({ loopStrategy: [envelope] }, 'addAsNew', [], { service });

    const snapshots = await listRecoverySnapshots(service);
    expect(snapshots.ok).toBe(true);
    if (!snapshots.ok) return;
    expect(snapshots.data).toHaveLength(0);
  });

  it('rolls back replaceAll when re-persisting the recovery snapshot after clear() fails', async () => {
    const adapter = createFailingBulkWriteAdapter('recoverySnapshot');
    const service = createPersistenceService(adapter);
    await service.write('loopStrategy', 'existing', strategyPayload('existing', 'p1'));

    const envelope = createEnvelope(
      'loopStrategy',
      'strategy-2',
      strategyPayload('strategy-2', 'p1'),
    );
    const result = await applyImport({ loopStrategy: [envelope] }, 'replaceAll', [], {
      service,
      confirmedReplaceAll: true,
    });
    expect(result.ok).toBe(false);

    const list = await service.list<{ id: string }>('loopStrategy');
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.data.map((s) => s.id)).toEqual(['existing']);
  });

  it('creates a large-import recovery snapshot once the incoming record count crosses the threshold', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const envelopes = Array.from({ length: 25 }, (_, i) =>
      createEnvelope('loopStrategy', `strategy-${i}`, strategyPayload(`strategy-${i}`, 'p1')),
    );

    const result = await applyImport({ loopStrategy: envelopes }, 'mergeNonConflicting', [], {
      service,
    });
    expect(result.ok).toBe(true);

    const snapshots = await listRecoverySnapshots(service);
    expect(snapshots.ok).toBe(true);
    if (!snapshots.ok) return;
    expect(snapshots.data).toHaveLength(1);
    expect(snapshots.data[0]?.payload.reason).toBe('large-import');
  });
});

describe('applyImport — issues pass-through', () => {
  it('carries validator issues into warnings/unsupportedRecords on a successful result', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    const result = await applyImport(
      {},
      'addAsNew',
      [
        {
          recordType: 'portfolio',
          recordId: 'p1',
          code: 'DUPLICATE_RECORD_ID',
          message: 'dup warning',
        },
        {
          recordType: 'portfolio',
          recordId: 'p2',
          code: 'INVALID_RECORD',
          message: 'invalid record',
        },
      ],
      { service },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.warnings).toEqual(['dup warning']);
    expect(result.data.unsupportedRecords).toEqual(['invalid record']);
  });
});
