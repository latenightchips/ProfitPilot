/**
 * Dashboard Quick Actions builder — 06_TASKS.md M5-016. See
 * `../types/quickActions.ts` for the full design reasoning.
 */
import type { QuickActionsData } from '../types/quickActions';

const NOT_YET_AVAILABLE = 'This feature is not yet available in this version of ProfitPilot.';

export function buildQuickActions(calculationSucceeded: boolean): QuickActionsData {
  return {
    links: [
      { label: 'Edit portfolio', href: '/portfolio', available: true, unavailableReason: null },
      {
        label: 'Run simulation',
        href: '/simulation',
        available: false,
        unavailableReason: NOT_YET_AVAILABLE,
      },
      {
        label: 'Build loop strategy',
        href: '/loop-builder',
        available: false,
        unavailableReason: NOT_YET_AVAILABLE,
      },
      {
        label: 'Create exit plan',
        href: '/exit-planner',
        available: false,
        unavailableReason: NOT_YET_AVAILABLE,
      },
      { label: 'Update prices', href: '/portfolio', available: true, unavailableReason: null },
    ],
    exportAvailable: calculationSucceeded,
    exportUnavailableReason: calculationSucceeded
      ? null
      : 'No calculated summary is available to export. Use the recovery copy download above instead.',
  };
}
