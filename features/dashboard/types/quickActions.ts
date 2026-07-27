/**
 * Dashboard Quick Actions types — 06_TASKS.md M5-016 ("Implement
 * Dashboard Quick Actions"). Dependencies: M5-001. Description: "Provide
 * navigation shortcuts to common workflows." DoD: "Users can reach the
 * next relevant workflow directly from the Dashboard."
 *
 * **Maps to 03_UI.md's own "PAGE ACTIONS" section** ("Refresh Portfolio,
 * Run Simulation, Build Loop, Open Exit Planner, Export Portfolio") —
 * `06_TASKS.md`'s own 6-item Action list is the authoritative,
 * more-granular version followed here (splitting "Refresh Portfolio"
 * into "Edit portfolio" + "Update prices," both real destinations on the
 * same `/portfolio` page — not a discrepancy, `06_TASKS.md` is this
 * engagement's authoritative task backlog per established practice).
 *
 * **"Run simulation" / "Build loop strategy" / "Create exit plan" are
 * marked unavailable, not linked as if functional.** `/simulation`,
 * `/loop-builder`, and `/exit-planner` are still Milestone 1
 * `PlaceholderPage` scaffolds (`components/layout/PlaceholderPage.tsx`'s
 * own text: "Functionality is implemented in a later milestone") —
 * Milestones 6/7 have not been reached in this engagement. Presenting
 * them as live, working actions would misrepresent what the application
 * can currently do; this task's own Requirement ("Unavailable actions
 * should explain why") gives an explicit, documented basis for marking
 * them unavailable rather than linking through anyway (as the sidebar,
 * an M1 scaffold predating this Requirement, already does).
 *
 * **"Edit portfolio" / "Update prices" are always available** once
 * Quick Actions renders at all (only inside the selected-portfolio
 * branch of `app/page.tsx`) — editing is possible regardless of
 * calculation success, the same reasoning `DashboardErrorBanner`'s own
 * "Return to Portfolio" link already relies on.
 *
 * **"Export portfolio" is the one action whose availability genuinely
 * reflects current portfolio state** (this task's own Requirement),
 * not just feature existence — it exports the *calculated*
 * `DashboardMetrics` (`../utils/exportPortfolioSummary.ts`), which only
 * exist when `calculatePortfolioSummary` has actually succeeded. When it
 * has not, `DashboardErrorBanner`'s own "Download recovery copy" already
 * covers the equivalent raw-data-only case — this action is unavailable
 * rather than duplicating that with a different, smaller payload.
 */
export interface QuickActionLink {
  label: string;
  href: string;
  available: boolean;
  /** Non-null exactly when `available` is `false`. */
  unavailableReason: string | null;
}

export interface QuickActionsData {
  links: QuickActionLink[];
  exportAvailable: boolean;
  exportUnavailableReason: string | null;
}
