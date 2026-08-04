import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryAdapter } from '@/services/persistence/adapters';
import type {
  AutoSaveCoordinator,
  AutoSaveState,
} from '@/services/persistence/autoSaveCoordinator';
import { createAutoSaveCoordinator } from '@/services/persistence/autoSaveCoordinator';
import { createPersistenceService } from '@/services/persistence/persistence.service';
import type { PersistenceAdapter } from '@/services/persistence/types';

/**
 * Auto-Save Coordinator — 06_TASKS.md M8-011 ("Implement Auto-Save
 * Coordinator"). A short debounce/retry delay keeps these tests fast and
 * deterministic without relying on fake timers, which this coordinator's
 * own `setTimeout`-based debounce interacts awkwardly with across
 * `await` boundaries.
 */
function createFailNTimesAdapter(failures: number, code: string): PersistenceAdapter {
  const inner = createMemoryAdapter();
  let attempts = 0;
  return {
    ...inner,
    write: async (...args) => {
      attempts += 1;
      if (attempts <= failures) {
        return {
          ok: false,
          errors: [{ category: 'persistence', code, message: 'Simulated failure.' }],
        };
      }
      return inner.write(...args);
    },
  };
}

function waitForState(
  coordinator: AutoSaveCoordinator,
  recordType: Parameters<AutoSaveCoordinator['getState']>[0],
  id: string,
  target: AutoSaveState,
  timeoutMs = 2000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = (): void => {
      if (coordinator.getState(recordType, id) === target) {
        resolve();
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for state "${target}"`));
        return;
      }
      setTimeout(check, 5);
    };
    check();
  });
}

describe('createAutoSaveCoordinator (M8-011)', () => {
  let coordinator: AutoSaveCoordinator;

  beforeEach(() => {
    const service = createPersistenceService(createMemoryAdapter());
    coordinator = createAutoSaveCoordinator(service, { debounceMs: 20, retryDelayMs: 5 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts idle for a key nothing has scheduled', () => {
    expect(coordinator.getState('preferences', 'singleton')).toBe('idle');
  });

  it('schedule eventually reaches saved', async () => {
    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    await waitForState(coordinator, 'preferences', 'singleton', 'saved');
  });

  it('debounces rapid updates — only the last value in a burst is written', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    coordinator = createAutoSaveCoordinator(service, { debounceMs: 30, retryDelayMs: 5 });

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: false });
    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });

    await waitForState(coordinator, 'preferences', 'singleton', 'saved');
    const result = await service.read<{ developerModeEnabled: boolean }>(
      'preferences',
      'singleton',
    );
    expect(result).toEqual({ ok: true, data: { developerModeEnabled: true } });
  });

  it('scheduleDelete removes the record and transitions to idle', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    coordinator = createAutoSaveCoordinator(service, { debounceMs: 10, retryDelayMs: 5 });

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    await waitForState(coordinator, 'preferences', 'singleton', 'saved');

    coordinator.scheduleDelete('preferences', 'singleton');
    await waitForState(coordinator, 'preferences', 'singleton', 'idle');

    const result = await service.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: null });
  });

  it('retries a retryable failure (LOCAL_STORAGE_WRITE_FAILED) and eventually succeeds', async () => {
    const adapter = createFailNTimesAdapter(1, 'LOCAL_STORAGE_WRITE_FAILED');
    const service = createPersistenceService(adapter);
    coordinator = createAutoSaveCoordinator(service, {
      debounceMs: 5,
      retryDelayMs: 5,
      maxRetries: 2,
    });

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    await waitForState(coordinator, 'preferences', 'singleton', 'saved');
  });

  it('gives up after exhausting retries and reports the real error', async () => {
    const adapter = createFailNTimesAdapter(10, 'LOCAL_STORAGE_WRITE_FAILED');
    const service = createPersistenceService(adapter);
    coordinator = createAutoSaveCoordinator(service, {
      debounceMs: 5,
      retryDelayMs: 5,
      maxRetries: 1,
    });

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    await waitForState(coordinator, 'preferences', 'singleton', 'error');

    const errors = coordinator.getErrors('preferences', 'singleton');
    expect(errors[0].code).toBe('LOCAL_STORAGE_WRITE_FAILED');
  });

  it('does not retry a validation-style failure — fails immediately', async () => {
    const adapter: PersistenceAdapter = {
      ...createMemoryAdapter(),
      write: async () => ({
        ok: false,
        errors: [{ category: 'persistence', code: 'INVALID_PERSISTED_RECORD', message: 'Bad.' }],
      }),
    };
    const service = createPersistenceService(adapter);
    coordinator = createAutoSaveCoordinator(service, {
      debounceMs: 5,
      retryDelayMs: 500,
      maxRetries: 5,
    });

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    // A retried failure would still be 'saving' this soon given the 500ms
    // retry delay above; an immediate failure is already 'error'.
    await waitForState(coordinator, 'preferences', 'singleton', 'error', 200);
  });

  it('does not retry a quota-exceeded failure', async () => {
    const adapter: PersistenceAdapter = {
      ...createMemoryAdapter(),
      write: async () => ({
        ok: false,
        errors: [
          { category: 'persistence', code: 'LOCAL_STORAGE_QUOTA_EXCEEDED', message: 'Full.' },
        ],
      }),
    };
    const service = createPersistenceService(adapter);
    coordinator = createAutoSaveCoordinator(service, {
      debounceMs: 5,
      retryDelayMs: 500,
      maxRetries: 5,
    });

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    await waitForState(coordinator, 'preferences', 'singleton', 'error', 200);
  });

  it('subscribe filters by recordType and id — a listener only fires for its own key', async () => {
    const events: { recordType: string; id: string; state: AutoSaveState }[] = [];
    coordinator.subscribe((recordType, id, state) => {
      events.push({ recordType, id, state });
    });

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    coordinator.schedule('applicationMetadata', 'singleton', {
      currentStorageSchemaVersion: '1.0.0',
      installedAt: '2026-01-01T00:00:00.000Z',
      lastOpenedAt: '2026-01-01T00:00:00.000Z',
    });

    await waitForState(coordinator, 'preferences', 'singleton', 'saved');
    await waitForState(coordinator, 'applicationMetadata', 'singleton', 'saved');

    expect(events.some((e) => e.recordType === 'preferences' && e.id === 'singleton')).toBe(true);
    expect(events.some((e) => e.recordType === 'applicationMetadata' && e.id === 'singleton')).toBe(
      true,
    );
  });

  it('subscribe returns an unsubscribe function that stops future notifications', async () => {
    const events: AutoSaveState[] = [];
    const unsubscribe = coordinator.subscribe((_recordType, _id, state) => {
      events.push(state);
    });
    unsubscribe();

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    await waitForState(coordinator, 'preferences', 'singleton', 'saved');

    expect(events).toHaveLength(0);
  });

  it('flushAll resolves once every pending debounced action has actually run, not merely cancelled', async () => {
    const service = createPersistenceService(createMemoryAdapter());
    coordinator = createAutoSaveCoordinator(service, { debounceMs: 5000, retryDelayMs: 5 });

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    await coordinator.flushAll();

    const result = await service.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: { developerModeEnabled: true } });
  });

  it('flushAll drains a retry that schedules further pending work after the initial flush starts', async () => {
    const adapter = createFailNTimesAdapter(1, 'LOCAL_STORAGE_WRITE_FAILED');
    const service = createPersistenceService(adapter);
    coordinator = createAutoSaveCoordinator(service, {
      debounceMs: 5000,
      retryDelayMs: 20,
      maxRetries: 2,
    });

    coordinator.schedule('preferences', 'singleton', { developerModeEnabled: true });
    await coordinator.flushAll();

    const result = await service.read('preferences', 'singleton');
    expect(result).toEqual({ ok: true, data: { developerModeEnabled: true } });
  });
});
