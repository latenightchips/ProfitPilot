'use client';

import { useDeveloperModeStore } from '@/stores/developerModeStore';

/**
 * Developer Mode Toggle — 06_TASKS.md M5-022 ("Implement Dashboard
 * Developer Mode"). Dependencies: M5-003. DoD: "Advanced information is
 * available without cluttering the default experience."
 *
 * **Where the toggle state lives — investigated, not assumed.**
 * 03_UI.md's own "DEVELOPER MODE" section says "It is disabled by
 * default," implying a persistent, app-wide control — but its own
 * "SETTINGS" page section's literal Version 1 field list (BTC Price
 * Provider, Currency, Target Health Factor, Display Precision, Theme)
 * does not name a Developer Mode toggle, and no task anywhere in
 * `06_TASKS.md` assigns building a Settings page (`/settings` remains
 * the Milestone 1 `PlaceholderPage` scaffold). M5-022's own Dependencies
 * list is only M5-003, not a Settings-page task — confirming this
 * toggle is meant to be self-contained. `useDeveloperModeStore`
 * (`stores/developerModeStore.ts`, new this batch) is a small, dedicated
 * Zustand store, the same lightweight-Store pattern
 * `stores/portfolioStore.ts` already established for comparable
 * cross-component UI state — in-memory only, per Conflict B, so the
 * preference resets on a real page reload, the same caveat already
 * documented for the active-portfolio selection itself.
 *
 * Rendered in the Dashboard's shared base section (`app/page.tsx`),
 * alongside `DashboardSummaryHeader`/`DataFreshnessSection`/
 * `QuickActionsSection` — a display preference, not something that
 * depends on `calculatePortfolioSummary` succeeding.
 *
 * **"Developer Mode must not change calculation behavior"** (this
 * task's own Requirement): enforced structurally — `enabled` is read
 * only by Dashboard view-layer components deciding what to render; no
 * Engine or Service call anywhere takes it as an input.
 */
export function DeveloperModeToggle() {
  const enabled = useDeveloperModeStore((state) => state.enabled);
  const toggle = useDeveloperModeStore((state) => state.toggle);

  return (
    <label className="flex w-fit items-center gap-2 text-xs text-muted-foreground">
      <input type="checkbox" checked={enabled} onChange={toggle} className="h-3.5 w-3.5" />
      Developer Mode
    </label>
  );
}
