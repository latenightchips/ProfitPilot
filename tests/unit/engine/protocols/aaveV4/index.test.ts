import { describe, expect, it } from 'vitest';

import { projectAaveV4Debt as barrelProjectAaveV4Debt } from '@/engine/protocols/aaveV4';
import { projectAaveV4Debt } from '@/engine/protocols/aaveV4/projectAaveV4Debt';

/**
 * Aave V4 barrel — V4 Readiness Audit §12 Stage 2. Stage 1's stub tests
 * (asserting every call failed closed with `AAVE_V4_PROJECTION_NOT_IMPLEMENTED`)
 * are obsolete now that this module has real math; `math.test.ts` and
 * `projectAaveV4Debt.test.ts` cover that math directly. This file only
 * proves the barrel re-exports the real implementation unchanged.
 */
describe('Aave V4 barrel — re-exports the real projectAaveV4Debt (Stage 2)', () => {
  it('the barrel export is reference-identical to the module it wraps', () => {
    expect(barrelProjectAaveV4Debt).toBe(projectAaveV4Debt);
  });

  it('produces a real computed value, never the Stage 1 unsupported-boundary error', () => {
    const result = barrelProjectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 365,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalDebt).toBeGreaterThan(20000);
  });
});
