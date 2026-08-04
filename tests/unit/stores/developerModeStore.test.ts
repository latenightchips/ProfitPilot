import { beforeEach, describe, expect, it } from 'vitest';

import type { PersistedPreferences } from '@/services';
import { autoSaveCoordinator, persistenceService, SINGLETON_RECORD_ID } from '@/services';
import { useDeveloperModeStore } from '@/stores/developerModeStore';

/**
 * Developer Mode Store — 06_TASKS.md M5-022. Persistence added in
 * Milestone 8 Batch 2 (M8-006–M8-013).
 */
beforeEach(() => {
  useDeveloperModeStore.setState({ enabled: false });
  window.localStorage.clear();
});

describe('useDeveloperModeStore', () => {
  it('starts disabled by default (03_UI.md: "It is disabled by default")', () => {
    expect(useDeveloperModeStore.getState().enabled).toBe(false);
  });

  it('toggle() flips the enabled flag', () => {
    useDeveloperModeStore.getState().toggle();
    expect(useDeveloperModeStore.getState().enabled).toBe(true);

    useDeveloperModeStore.getState().toggle();
    expect(useDeveloperModeStore.getState().enabled).toBe(false);
  });
});

describe('useDeveloperModeStore — local preference persistence (M8-009)', () => {
  it('toggle() schedules a real local storage write, readable back through persistenceService', async () => {
    useDeveloperModeStore.getState().toggle();
    await autoSaveCoordinator.flushAll();

    const stored = await persistenceService.read<PersistedPreferences>(
      'preferences',
      SINGLETON_RECORD_ID,
    );
    expect(stored).toEqual({ ok: true, data: { developerModeEnabled: true } });
  });

  it('load() hydrates enabled from local storage, flushing first', async () => {
    useDeveloperModeStore.getState().toggle();

    useDeveloperModeStore.setState({ enabled: false });
    await useDeveloperModeStore.getState().load();

    expect(useDeveloperModeStore.getState().enabled).toBe(true);
  });

  it('load() is a safe no-op when nothing has ever been saved', async () => {
    await useDeveloperModeStore.getState().load();
    expect(useDeveloperModeStore.getState().enabled).toBe(false);
  });
});
