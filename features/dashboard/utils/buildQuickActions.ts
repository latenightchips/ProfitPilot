/**
 * Dashboard Quick Actions builder — 06_TASKS.md M5-016. See
 * `../types/quickActions.ts` for the full design reasoning.
 *
 * **"Run simulation"/"Build loop strategy"/"Create exit plan" are real
 * links, not disabled placeholders — a genuine defect found and fixed
 * during Milestone 9 Batch 4 (M9-017, "Complete Mobile End-to-End
 * Suite").** They were correctly marked `available: false` when M5-016
 * first built this file (Milestone 6/7's Simulation/Loop Builder/Exit
 * Planner routes did not exist yet), but were never revisited once those
 * milestones shipped fully working routes at `/simulation`/
 * `/loop-builder`/`/exit-planner` — every one of those routes' own e2e
 * suites (`tests/e2e/simulationWorkflows.spec.ts`,
 * `loopBuilderWorkflows.spec.ts`, `exitPlannerWorkflows.spec.ts`) has
 * passed since Milestones 6/7 completed, proving the routes themselves
 * were never the blocker. This mattered enough to fix now, not just note,
 * because `AppSidebar` has no mobile equivalent (`hidden md:block`,
 * Milestone 5's own documented, accepted scope decision — see
 * `PROJECT_STATUS.md`'s "Mobile navigation gap noted, not built") —
 * Quick Actions was the *only* way a mobile user could ever reach these
 * three tools from the Dashboard, and it was silently lying to them
 * ("This feature is not yet available in this version of ProfitPilot")
 * about tools that had worked for three milestones.
 */
import type { QuickActionsData } from '../types/quickActions';

export function buildQuickActions(calculationSucceeded: boolean): QuickActionsData {
  return {
    links: [
      { label: 'Edit portfolio', href: '/portfolio', available: true, unavailableReason: null },
      { label: 'Run simulation', href: '/simulation', available: true, unavailableReason: null },
      {
        label: 'Build loop strategy',
        href: '/loop-builder',
        available: true,
        unavailableReason: null,
      },
      {
        label: 'Create exit plan',
        href: '/exit-planner',
        available: true,
        unavailableReason: null,
      },
      { label: 'Update prices', href: '/portfolio', available: true, unavailableReason: null },
    ],
    exportAvailable: calculationSucceeded,
    exportUnavailableReason: calculationSucceeded
      ? null
      : 'No calculated summary is available to export. Use the recovery copy download above instead.',
  };
}
