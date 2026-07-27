import { describe, expect, it } from 'vitest';

import type { DashboardMetric } from '@/features/dashboard';
import { buildKpiDeveloperDetails } from '@/features/dashboard';

/**
 * KPI Developer Mode details builder — 06_TASKS.md M5-022.
 */
function metric(overrides: Partial<DashboardMetric> = {}): DashboardMetric {
  return {
    label: 'Health Factor',
    rawValue: 4,
    formattedValue: '4',
    status: 'ok',
    formulaId: 'F-022',
    ...overrides,
  };
}

describe('buildKpiDeveloperDetails — available metric', () => {
  it('includes the Formula ID, raw value, and Engine/Formula version', () => {
    const result = buildKpiDeveloperDetails(metric(), '1.0', '1.0');
    expect(result).toBe('Formula ID: F-022 · Raw value: 4 · Engine v1.0, Formula v1.0');
  });
});

describe('buildKpiDeveloperDetails — unavailable metric', () => {
  it('returns undefined when the metric has no Formula ID (nothing to elaborate on)', () => {
    const result = buildKpiDeveloperDetails(
      metric({ formulaId: null, rawValue: null, formattedValue: 'N/A (no debt)' }),
      '1.0',
      '1.0',
    );
    expect(result).toBeUndefined();
  });
});
