import { describe, expect, it } from 'vitest';

import { projectVariableDebt as projectAaveV3Debt } from '@/engine/protocols/aaveV3';
import { projectProtocolDebt } from '@/engine/protocols/index';
import type { AaveProtocolVersion } from '@/engine/protocols/types';

/**
 * Protocol/version dispatch registry — V4 Readiness Audit §12 Stage 1.
 * Proves the three architectural guarantees the stage exists for:
 * Aave V3 resolves to the current, unmodified V3 projector; Aave V4
 * resolves to the explicit unsupported boundary; and an unrecognized
 * protocol/version value fails closed rather than throwing or silently
 * defaulting to V3.
 */
describe('projectProtocolDebt — registry dispatch (V4 Readiness Audit §12 Stage 1)', () => {
  it('"v3" resolves to the exact same result as calling the V3 projector directly', () => {
    const direct = projectAaveV3Debt(20000, 0.05, 365);
    const dispatched = projectProtocolDebt('v3', 20000, 0.05, 365);

    expect(dispatched.ok).toBe(true);
    expect(direct.ok).toBe(true);
    if (!dispatched.ok || !direct.ok) return;

    expect(dispatched.value).toBe(direct.value);
    expect(dispatched.metadata.formulaId).toBe(direct.metadata.formulaId);
    expect(dispatched.metadata.formulaVersion).toBe(direct.metadata.formulaVersion);
    expect(dispatched.metadata.engineVersion).toBe(direct.metadata.engineVersion);
    expect(dispatched.metadata.inputsUsed).toEqual(direct.metadata.inputsUsed);
  });

  it('"v3" produces the independently-derived exact value ($20,000 @ 5% APR / 365 days)', () => {
    const result = projectProtocolDebt('v3', 20000, 0.05, 365);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(21025.4167, 4);
  });

  it('"v3" propagates a V3 validation failure unchanged (does not swallow or reshape it)', () => {
    const direct = projectAaveV3Debt(-1, 0.05, 365);
    const dispatched = projectProtocolDebt('v3', -1, 0.05, 365);
    expect(dispatched.ok).toBe(false);
    expect(direct.ok).toBe(false);
    if (dispatched.ok || direct.ok) return;
    expect(dispatched.error.code).toBe(direct.error.code);
  });

  it('"v4" resolves to the explicit unsupported boundary, never a computed value', () => {
    const result = projectProtocolDebt('v4', 20000, 0.05, 365);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_PROJECTION_NOT_IMPLEMENTED');
  });

  it('"v4" never matches what "v3" would have returned for the same inputs (no accidental V3 fallback)', () => {
    const v3Result = projectProtocolDebt('v3', 20000, 0.05, 365);
    const v4Result = projectProtocolDebt('v4', 20000, 0.05, 365);
    expect(v3Result.ok).toBe(true);
    expect(v4Result.ok).toBe(false);
  });

  it('an unrecognized protocol/version value fails closed rather than throwing', () => {
    const bogusVersion = 'v2' as unknown as AaveProtocolVersion;
    expect(() => projectProtocolDebt(bogusVersion, 20000, 0.05, 365)).not.toThrow();

    const result = projectProtocolDebt(bogusVersion, 20000, 0.05, 365);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROTOCOL_VERSION_UNSUPPORTED');
    expect(result.error.message).toContain('v2');
  });

  it('an unrecognized protocol/version value does not fall back to V3 or V4 output', () => {
    const bogusVersion = 'unknown-protocol' as unknown as AaveProtocolVersion;
    const result = projectProtocolDebt(bogusVersion, 20000, 0.05, 365);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).not.toBe('AAVE_V4_PROJECTION_NOT_IMPLEMENTED');
    expect('value' in result).toBe(false);
  });
});
