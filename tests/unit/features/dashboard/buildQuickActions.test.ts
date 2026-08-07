import { describe, expect, it } from 'vitest';

import { buildQuickActions } from '@/features/dashboard';

/**
 * Dashboard Quick Actions builder — 06_TASKS.md M5-016.
 *
 * "Run simulation"/"Build loop strategy"/"Create exit plan" are asserted
 * available here — see `buildQuickActions.ts`'s own header comment for
 * why (Milestone 9 Batch 4, M9-017, a real defect fix: these three were
 * still hardcoded unavailable long after their routes were fully built).
 */
describe('buildQuickActions — calculation succeeded', () => {
  it('marks every navigation link available, with the real route each targets, and export available', () => {
    const actions = buildQuickActions(true);

    const byLabel = Object.fromEntries(actions.links.map((link) => [link.label, link]));
    const expectedHrefs: Record<string, string> = {
      'Edit portfolio': '/portfolio',
      'Run simulation': '/simulation',
      'Build loop strategy': '/loop-builder',
      'Create exit plan': '/exit-planner',
      'Update prices': '/portfolio',
    };
    for (const [label, href] of Object.entries(expectedHrefs)) {
      expect(byLabel[label].available).toBe(true);
      expect(byLabel[label].unavailableReason).toBeNull();
      expect(byLabel[label].href).toBe(href);
    }

    expect(actions.exportAvailable).toBe(true);
    expect(actions.exportUnavailableReason).toBeNull();
  });
});

describe('buildQuickActions — calculation failed', () => {
  it('marks export unavailable while navigation links stay unchanged', () => {
    const actions = buildQuickActions(false);

    expect(actions.exportAvailable).toBe(false);
    expect(actions.exportUnavailableReason).not.toBeNull();

    const byLabel = Object.fromEntries(actions.links.map((link) => [link.label, link]));
    expect(byLabel['Edit portfolio'].available).toBe(true);
    expect(byLabel['Update prices'].available).toBe(true);
  });
});
