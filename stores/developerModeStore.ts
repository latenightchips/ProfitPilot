/**
 * Developer Mode Store — 06_TASKS.md M5-022 ("Implement Dashboard
 * Developer Mode"). Dependencies: M5-003. Description: "Expose advanced
 * calculation details when Developer Mode is enabled." Requirement:
 * "Developer Mode must not change calculation behavior." DoD: "Advanced
 * information is available without cluttering the default experience."
 *
 * **Where the toggle state lives — a real, investigated gap, not
 * assumed.** 03_UI.md's own "DEVELOPER MODE" section says "It is
 * disabled by default," implying a persistent, app-wide toggle exists
 * somewhere. But `03_UI.md`'s own "SETTINGS" page section (its literal
 * Version 1 field list: BTC Price Provider, Currency, Target Health
 * Factor, Display Precision, Theme) does not name a Developer Mode
 * toggle at all, and no task anywhere in `06_TASKS.md` assigns building
 * a Settings page (`/settings` remains the Milestone 1
 * `PlaceholderPage` scaffold). M5-022's own Dependencies list is only
 * M5-003 — not a Settings-page task — confirming this toggle is meant
 * to be self-contained, not routed through infrastructure no task
 * builds. A small, dedicated Zustand store is this project's own
 * already-established pattern for exactly this shape of need
 * (`stores/portfolioStore.ts`'s own precedent).
 *
 * **"Must not change calculation behavior"**: enforced structurally, not
 * just by convention — this store holds a single UI-only boolean with no
 * calculation logic, imported by nothing in `engine/` or `services/`.
 *
 * **Persistence (Milestone 8 Batch 2, M8-006–M8-013)**: `toggle` now also
 * schedules a `PersistedPreferences` write via `autoSaveCoordinator`,
 * keyed under `SINGLETON_RECORD_ID` — the same app-wide singleton pattern
 * `stores/portfolioStore.ts`'s own `activePortfolio` record uses. `load`
 * restores it on mount via `providers/PersistenceProvider.tsx`, the same
 * as every other Store's own `load*` action.
 */
import { create } from 'zustand';

import {
  autoSaveCoordinator,
  type PersistedPreferences,
  persistenceService,
  SINGLETON_RECORD_ID,
} from '@/services';

export interface DeveloperModeState {
  enabled: boolean;
  toggle: () => void;
  load: () => Promise<void>;
}

function schedulePreferencesSave(enabled: boolean): void {
  const payload: PersistedPreferences = { developerModeEnabled: enabled };
  autoSaveCoordinator.schedule('preferences', SINGLETON_RECORD_ID, payload);
}

export const useDeveloperModeStore = create<DeveloperModeState>((set) => ({
  enabled: false,

  toggle: () =>
    set((state) => {
      const enabled = !state.enabled;
      schedulePreferencesSave(enabled);
      return { enabled };
    }),

  load: async () => {
    await autoSaveCoordinator.flushAll();
    const result = await persistenceService.read<PersistedPreferences>(
      'preferences',
      SINGLETON_RECORD_ID,
    );
    if (!result.ok || result.data === null) return;
    set({ enabled: result.data.developerModeEnabled });
  },
}));
