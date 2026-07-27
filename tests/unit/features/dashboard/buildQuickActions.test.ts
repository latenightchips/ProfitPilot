import { describe, expect, it } from 'vitest';

import { buildQuickActions } from '@/features/dashboard';

/**
 * Dashboard Quick Actions builder — 06_TASKS.md M5-016.
 */
describe('buildQuickActions — calculation succeeded', () => {
  it('marks Edit portfolio and Update prices available, the three unbuilt workflows unavailable, and export available', () => {
    const actions = buildQuickActions(true);

    const byLabel = Object.fromEntries(actions.links.map((link) => [link.label, link]));
    expect(byLabel['Edit portfolio'].available).toBe(true);
    expect(byLabel['Edit portfolio'].href).toBe('/portfolio');
    expect(byLabel['Update prices'].available).toBe(true);
    expect(byLabel['Update prices'].href).toBe('/portfolio');

    for (const label of ['Run simulation', 'Build loop strategy', 'Create exit plan']) {
      expect(byLabel[label].available).toBe(false);
      expect(byLabel[label].unavailableReason).not.toBeNull();
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
