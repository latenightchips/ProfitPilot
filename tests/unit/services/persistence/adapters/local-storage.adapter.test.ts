import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLocalStorageAdapter } from '@/services/persistence/adapters/local-storage.adapter';
import { buildLocalStorageKey } from '@/services/persistence/adapters/localStorageKeys';
import { createEnvelope } from '@/services/persistence/envelope';
import type { PersistenceAdapter } from '@/services/persistence/types';

/**
 * Browser Local Storage Adapter — 06_TASKS.md M8-006 ("Implement Local
 * Storage Adapter"). DoD: "The adapter handles malformed data, unavailable
 * storage, and quota errors safely." Exercises the same
 * `PersistenceAdapter` contract `memory.adapter.test.ts` already covers,
 * plus the failure paths unique to a real browser storage backend.
 */
describe('createLocalStorageAdapter (M8-006)', () => {
  let adapter: PersistenceAdapter;

  beforeEach(() => {
    window.localStorage.clear();
    adapter = createLocalStorageAdapter();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reports itself available when window.localStorage works', () => {
    expect(adapter.checkAvailability()).toEqual({ available: true });
  });

  it('returns null, not an error, for a record that was never written', async () => {
    const result = await adapter.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: null });
  });

  it('round-trips a written record through read, under the namespaced key', async () => {
    const envelope = createEnvelope('preferences', 'singleton', { developerModeEnabled: true });
    await adapter.write('preferences', 'singleton', envelope);

    expect(
      window.localStorage.getItem(buildLocalStorageKey('preferences', 'singleton')),
    ).not.toBeNull();
    const result = await adapter.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: envelope });
  });

  it('deletes a record', async () => {
    const envelope = createEnvelope('preferences', 'singleton', { developerModeEnabled: true });
    await adapter.write('preferences', 'singleton', envelope);
    await adapter.delete('preferences', 'singleton');
    expect(await adapter.read('preferences', 'singleton')).toEqual({ ok: true, data: null });
  });

  it('deleting a record that never existed is a safe no-op', async () => {
    const result = await adapter.delete('preferences', 'never-written');
    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('lists every record under a record type without leaking unrelated keys', async () => {
    const a = createEnvelope('loopStrategy', 'a', { id: 'a' });
    const b = createEnvelope('loopStrategy', 'b', { id: 'b' });
    await adapter.write('loopStrategy', 'a', a);
    await adapter.write('loopStrategy', 'b', b);
    window.localStorage.setItem('unrelated-app-key', 'not ours');

    const result = await adapter.list('loopStrategy');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data).toEqual(expect.arrayContaining([a, b]));
  });

  it('bulkWrite stores every envelope keyed by its own recordId', async () => {
    const a = createEnvelope('simulation', 'a', { id: 'a' });
    const b = createEnvelope('simulation', 'b', { id: 'b' });
    await adapter.bulkWrite('simulation', [a, b]);

    const result = await adapter.list('simulation');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
  });

  it('clear removes only ProfitPilot-owned keys, leaving unrelated localStorage entries intact', async () => {
    await adapter.write('preferences', 'singleton', createEnvelope('preferences', 'singleton', {}));
    window.localStorage.setItem('unrelated-app-key', 'not ours');

    await adapter.clear();

    expect(await adapter.read('preferences', 'singleton')).toEqual({ ok: true, data: null });
    expect(window.localStorage.getItem('unrelated-app-key')).toBe('not ours');
  });

  describe('unavailable storage', () => {
    it('checkAvailability reports unavailable when window.localStorage is absent', () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
      // @ts-expect-error — deliberately simulating an environment with no localStorage.
      delete window.localStorage;

      const result = createLocalStorageAdapter().checkAvailability();
      expect(result.available).toBe(false);

      if (originalDescriptor) Object.defineProperty(window, 'localStorage', originalDescriptor);
    });

    it('read fails safely (LOCAL_STORAGE_UNAVAILABLE) when window.localStorage is absent', async () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
      // @ts-expect-error — deliberately simulating an environment with no localStorage.
      delete window.localStorage;

      const result = await createLocalStorageAdapter().read('preferences', 'singleton');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0].code).toBe('LOCAL_STORAGE_UNAVAILABLE');

      if (originalDescriptor) Object.defineProperty(window, 'localStorage', originalDescriptor);
    });
  });

  describe('malformed data', () => {
    it('read fails safely (LOCAL_STORAGE_MALFORMED_DATA) on invalid JSON', async () => {
      window.localStorage.setItem(
        buildLocalStorageKey('preferences', 'singleton'),
        '{not valid json',
      );
      const result = await adapter.read('preferences', 'singleton');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0].code).toBe('LOCAL_STORAGE_MALFORMED_DATA');
    });

    it('list fails safely (LOCAL_STORAGE_MALFORMED_DATA) when a stored record is invalid JSON', async () => {
      window.localStorage.setItem(
        buildLocalStorageKey('loopStrategy', 'corrupt'),
        '{not valid json',
      );
      const result = await adapter.list('loopStrategy');
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors[0].code).toBe('LOCAL_STORAGE_MALFORMED_DATA');
    });
  });

  describe('quota exceeded (M8-012)', () => {
    it('write fails safely with LOCAL_STORAGE_QUOTA_EXCEEDED and an actionable message', async () => {
      const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
      vi.spyOn(Object.getPrototypeOf(window.localStorage) as Storage, 'setItem').mockImplementation(
        () => {
          throw quotaError;
        },
      );

      const result = await adapter.write(
        'preferences',
        'singleton',
        createEnvelope('preferences', 'singleton', { developerModeEnabled: true }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0].code).toBe('LOCAL_STORAGE_QUOTA_EXCEEDED');
      expect(result.errors[0].message).toMatch(/export/i);
    });

    it('write fails safely (LOCAL_STORAGE_WRITE_FAILED) for a non-quota storage error', async () => {
      vi.spyOn(Object.getPrototypeOf(window.localStorage) as Storage, 'setItem').mockImplementation(
        () => {
          throw new Error('Some other storage failure.');
        },
      );

      const result = await adapter.write(
        'preferences',
        'singleton',
        createEnvelope('preferences', 'singleton', { developerModeEnabled: true }),
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0].code).toBe('LOCAL_STORAGE_WRITE_FAILED');
    });
  });
});
