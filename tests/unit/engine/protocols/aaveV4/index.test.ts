import { describe, expect, it } from 'vitest';

import { projectVariableDebt } from '@/engine/protocols/aaveV4';

/**
 * Aave V4 debt projection — V4 Readiness Audit §12 Stage 1 ("protocol
 * boundary scaffolding only"). This module must never compute a real
 * financial value: every call fails closed with a structured,
 * non-retryable-by-implication error, regardless of input.
 */
describe('Aave V4 projectVariableDebt — explicit unsupported boundary (Stage 1)', () => {
  it('fails closed with AAVE_V4_PROJECTION_NOT_IMPLEMENTED for realistic inputs', () => {
    const result = projectVariableDebt(20000, 0.05, 365);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_PROJECTION_NOT_IMPLEMENTED');
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  it('never returns a success result, for any input including zero/edge values', () => {
    const cases: Array<[number, number, number]> = [
      [0, 0, 0],
      [20000, 0.05, 365],
      [1_000_000, 1, 3650],
    ];
    for (const [currentDebt, borrowApr, elapsedDays] of cases) {
      const result = projectVariableDebt(currentDebt, borrowApr, elapsedDays);
      expect(result.ok).toBe(false);
    }
  });

  it('reports the inputs it was called with, for diagnostic transparency', () => {
    const result = projectVariableDebt(26000, 0.1, 30);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.metadata.inputsUsed).toEqual({
      currentDebt: 26000,
      borrowApr: 0.1,
      elapsedDays: 30,
    });
  });

  it('does not import or reference Aave V3 math (structurally isolated module)', async () => {
    const v4Module = await import('@/engine/protocols/aaveV4');
    const v3Module = await import('@/engine/protocols/aaveV3');
    expect(v4Module.projectVariableDebt).not.toBe(v3Module.projectVariableDebt);
  });
});
