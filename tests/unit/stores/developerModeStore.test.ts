import { beforeEach, describe, expect, it } from 'vitest';

import { useDeveloperModeStore } from '@/stores/developerModeStore';

/**
 * Developer Mode Store — 06_TASKS.md M5-022.
 */
beforeEach(() => {
  useDeveloperModeStore.setState({ enabled: false });
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
