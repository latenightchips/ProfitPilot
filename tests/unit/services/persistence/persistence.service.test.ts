import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryAdapter } from '@/services/persistence/adapters';
import { createEnvelope } from '@/services/persistence/envelope';
import type { PersistenceService } from '@/services/persistence/persistence.service';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import type { PersistedPreferences, PersistenceAdapter } from '@/services/persistence/types';
import type { Portfolio } from '@/types/portfolio';

/**
 * A `PersistenceAdapter` whose every method fails — proves
 * `PersistenceService` passes an adapter-level failure straight through
 * rather than swallowing or misreporting it. `MemoryAdapter` itself never
 * fails, so this is the only way to exercise that path.
 */
function createFailingAdapter(): PersistenceAdapter {
  const failure = {
    ok: false as const,
    errors: [
      {
        category: 'persistence' as const,
        code: 'SIMULATED_FAILURE',
        message: 'Simulated adapter failure.',
      },
    ],
  };
  return {
    name: 'failing',
    checkAvailability: () => ({ available: false, reason: 'Simulated unavailability.' }),
    read: async () => failure,
    write: async () => failure,
    delete: async () => failure,
    list: async () => failure,
    bulkWrite: async () => failure,
    clear: async () => failure,
  };
}

/**
 * Persistence Service — 06_TASKS.md M8-001 ("Create Persistence
 * Architecture"). DoD: "Application features access persistence through
 * typed adapters rather than browser or Supabase APIs directly." This is
 * the boundary Stores must use — see this file's own tests for what a
 * Store gets back: plain payloads, never a raw adapter or envelope, on
 * `read`/`list`.
 */
describe('createPersistenceService — read/write round trip', () => {
  let service: PersistenceService;

  beforeEach(() => {
    service = createPersistenceService(createMemoryAdapter());
  });

  it('returns null for a record that was never written', async () => {
    const result = await service.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: null });
  });

  it('write then read returns the plain payload, not an envelope', async () => {
    const payload: PersistedPreferences = { developerModeEnabled: true };
    await service.write('preferences', 'singleton', payload);
    const result = await service.read<PersistedPreferences>('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: payload });
  });

  it('write returns the full envelope it persisted', async () => {
    const result = await service.write('preferences', 'singleton', {
      developerModeEnabled: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.recordType).toBe('preferences');
    expect(result.data.recordId).toBe('singleton');
    expect(result.data.payload).toEqual({ developerModeEnabled: true });
  });

  it('preserves the original createdAt across an update, matching updateEnvelope semantics', async () => {
    const first = await service.write('preferences', 'singleton', {
      developerModeEnabled: false,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await service.write('preferences', 'singleton', {
      developerModeEnabled: true,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.data.createdAt).toBe(first.data.createdAt);
    expect(second.data.payload).toEqual({ developerModeEnabled: true });
  });

  it('deletes a record', async () => {
    await service.write('preferences', 'singleton', { developerModeEnabled: true });
    await service.delete('preferences', 'singleton');
    const result = await service.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: null });
  });

  it('list returns every payload under a record type', async () => {
    await service.write('preferences', 'singleton', { developerModeEnabled: true });
    const result = await service.list<PersistedPreferences>('preferences');
    expect(result).toEqual({ ok: true, data: [{ developerModeEnabled: true }] });
  });

  it('clear empties every record type', async () => {
    await service.write('preferences', 'singleton', { developerModeEnabled: true });
    await service.clear();
    const result = await service.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: null });
  });

  it('checkAvailability delegates to the underlying adapter', () => {
    expect(service.checkAvailability()).toEqual({ available: true });
  });
});

describe('createPersistenceService — validation boundary (M8-005)', () => {
  it('rejects a read of data that was corrupted directly at the adapter, never surfacing it to the caller', async () => {
    const adapter = createMemoryAdapter();
    // Simulates storage tampered with outside the application (e.g. hand-edited localStorage).
    const corrupted = {
      ...createEnvelope('preferences', 'singleton', { developerModeEnabled: true }),
    };
    corrupted.payload = 'not an object' as unknown as PersistedPreferences;
    await adapter.write('preferences', 'singleton', corrupted);

    const service = createPersistenceService(adapter);
    const result = await service.read('preferences', 'singleton');
    expect(result.ok).toBe(false);
  });

  it('bulkWrite rejects the whole batch if any envelope is invalid, writing nothing', async () => {
    const adapter = createMemoryAdapter();
    const service = createPersistenceService(adapter);

    const valid = createEnvelope('preferences', 'a', { developerModeEnabled: true });
    const invalid = {
      ...createEnvelope('preferences', 'b', { developerModeEnabled: true }),
      payload: 'not an object' as unknown as PersistedPreferences,
    };

    const result = await service.bulkWrite('preferences', [valid, invalid]);
    expect(result.ok).toBe(false);

    const list = await service.list('preferences');
    expect(list).toEqual({ ok: true, data: [] });
  });

  it('bulkWrite accepts a batch of valid envelopes', async () => {
    const adapter = createMemoryAdapter();
    const service = createPersistenceService(adapter);

    const a = createEnvelope('preferences', 'a', { developerModeEnabled: true });
    const result = await service.bulkWrite('preferences', [a]);
    expect(result.ok).toBe(true);

    const list = await service.list<PersistedPreferences>('preferences');
    expect(list).toEqual({ ok: true, data: [{ developerModeEnabled: true }] });
  });

  it("write rejects a payload that fails its own record type's schema, before ever calling the adapter", async () => {
    const adapter = createMemoryAdapter();
    const service = createPersistenceService(adapter);

    const invalidPortfolio = { asset: 'BTC', quantity: -1 } as unknown as Portfolio;
    const result = await service.write('portfolio', 'p1', invalidPortfolio);
    expect(result.ok).toBe(false);

    const list = await service.list('portfolio');
    expect(list).toEqual({ ok: true, data: [] });
  });

  it('list rejects the whole call if any one stored record fails validation', async () => {
    const adapter = createMemoryAdapter();
    const valid = createEnvelope('preferences', 'a', { developerModeEnabled: true });
    const invalid = {
      ...createEnvelope('preferences', 'b', { developerModeEnabled: true }),
      payload: 'not an object' as unknown as PersistedPreferences,
    };
    await adapter.bulkWrite('preferences', [valid, invalid]);

    const service = createPersistenceService(adapter);
    const result = await service.list('preferences');
    expect(result.ok).toBe(false);
  });
});

describe('createPersistenceService — adapter-level failure passthrough', () => {
  let service: PersistenceService;

  beforeEach(() => {
    service = createPersistenceService(createFailingAdapter());
  });

  it("checkAvailability passes through the adapter's own availability", () => {
    expect(service.checkAvailability()).toEqual({
      available: false,
      reason: 'Simulated unavailability.',
    });
  });

  it('read passes through an adapter failure unchanged', async () => {
    const result = await service.read('preferences', 'singleton');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('SIMULATED_FAILURE');
  });

  it('write passes through an adapter write failure unchanged', async () => {
    const result = await service.write('preferences', 'singleton', {
      developerModeEnabled: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].code).toBe('SIMULATED_FAILURE');
  });

  it('delete passes through an adapter failure unchanged', async () => {
    const result = await service.delete('preferences', 'singleton');
    expect(result.ok).toBe(false);
  });

  it('list passes through an adapter failure unchanged', async () => {
    const result = await service.list('preferences');
    expect(result.ok).toBe(false);
  });

  it('bulkWrite passes through an adapter failure unchanged', async () => {
    const envelope = createEnvelope('preferences', 'a', { developerModeEnabled: true });
    const result = await service.bulkWrite('preferences', [envelope]);
    expect(result.ok).toBe(false);
  });

  it('clear passes through an adapter failure unchanged', async () => {
    const result = await service.clear();
    expect(result.ok).toBe(false);
  });
});
