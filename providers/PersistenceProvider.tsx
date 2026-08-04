'use client';

/**
 * Persistence Provider — Milestone 8 Batch 2 (M8-006–M8-013). Hydrates
 * every Store from local storage once, on the very first client mount,
 * rather than each route-level page component independently deciding
 * when to load its own slice — a single, well-known place for "the app
 * has just started, restore everything" to live, wrapped around
 * `AppShell` in `app/layout.tsx` so it runs regardless of which route
 * the user lands on first.
 *
 * Each Store's own `load*` action already calls
 * `autoSaveCoordinator.flushAll()` before reading, so calling all six
 * here in parallel is safe — there is no risk of one Store's hydration
 * read racing another's in-flight write, since they persist under
 * disjoint record types.
 *
 * **Runs `runLocalDataMigration` (M8-013) first, before any Store
 * hydrates.** M8-013's own DoD — "Supported older data upgrades
 * automatically without silent loss" — means the migration runner must
 * actually execute on its own at startup, not just exist as a callable,
 * tested function nothing ever invokes. Awaited before the six `load*`
 * calls below so every Store's own read (`persistenceService.list`/
 * `.read`) always sees already-migrated, already-current-version data —
 * the same ordering `persistenceService`'s own per-record migration path
 * assumes, but applied once, atomically, across the whole dataset first.
 * Uses a fresh `createLocalStorageAdapter()` instance rather than
 * reaching into `persistenceService` internals — the adapter is stateless
 * (every method reads/writes `window.localStorage` directly), so a second
 * instance operates on the exact same underlying storage safely.
 */
import { useEffect } from 'react';

import { createLocalStorageAdapter, runLocalDataMigration } from '@/services';
import { useDeveloperModeStore } from '@/stores/developerModeStore';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';
import { useSimulationStore } from '@/stores/simulationStore';

export function PersistenceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function hydrate(): Promise<void> {
      await runLocalDataMigration(createLocalStorageAdapter());
      await Promise.all([
        usePortfolioStore.getState().load(),
        useLoopBuilderStore.getState().loadSavedStrategies(),
        useExitPlannerStore.getState().loadSavedPlans(),
        useSimulationStore.getState().loadSavedScenarios(),
        useRecommendationCenterStore.getState().loadAcknowledgements(),
        useDeveloperModeStore.getState().load(),
      ]);
    }
    void hydrate();
  }, []);

  return children;
}
