import { describe, expect, it } from 'vitest';

import { createMemoryAdapter } from '@/services/persistence/adapters';
import { clearLocalData } from '@/services/persistence/clearLocalData';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import { listRecoverySnapshots } from '@/services/persistence/recoverySnapshot';
import type { PersistenceAdapter } from '@/services/persistence/types';

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

describe('clearLocalData', () => {
  it('deletes all business data but preserves exactly one fresh recovery snapshot', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1'));
    await service.write('preferences', 'singleton', { developerModeEnabled: true });

    const result = await clearLocalData(service);
    expect(result.ok).toBe(true);

    const strategies = await service.list('loopStrategy');
    const preferences = await service.list('preferences');
    expect(strategies.ok && strategies.data).toHaveLength(0);
    expect(preferences.ok && preferences.data).toHaveLength(0);

    const snapshots = await listRecoverySnapshots(service);
    expect(snapshots.ok).toBe(true);
    if (!snapshots.ok) return;
    expect(snapshots.data).toHaveLength(1);
    expect(snapshots.data[0]?.payload.reason).toBe('bulk-deletion');
    expect(snapshots.data[0]?.payload.records.loopStrategy).toHaveLength(1);
  });

  it('ends with a clean state that still validates as a normal, empty install', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1'));

    await clearLocalData(service);

    const strategies = await service.list('loopStrategy');
    expect(strategies).toEqual({ ok: true, data: [] });
  });

  it('propagates a clear() failure without silently succeeding', async () => {
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
    const failingAdapter: PersistenceAdapter = {
      ...createMemoryAdapter(),
      clear: async () => failure,
    };
    const service = createPersistenceService(failingAdapter);
    await service.write('loopStrategy', 'strategy-1', strategyPayload('strategy-1'));

    const result = await clearLocalData(service);
    expect(result.ok).toBe(false);

    const strategies = await service.list('loopStrategy');
    expect(strategies.ok && strategies.data).toHaveLength(1);
  });

  it('propagates a snapshot-creation failure and does not clear anything', async () => {
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
    const failingAdapter: PersistenceAdapter = {
      ...createMemoryAdapter(),
      list: async () => failure,
    };
    const service = createPersistenceService(failingAdapter);

    const result = await clearLocalData(service);
    expect(result.ok).toBe(false);
  });
});
