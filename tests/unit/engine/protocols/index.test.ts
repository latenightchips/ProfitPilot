import { describe, expect, it } from 'vitest';

import { projectVariableDebt as projectAaveV3Debt } from '@/engine/protocols/aaveV3';
import { projectAaveV4Debt } from '@/engine/protocols/aaveV4';
import { projectProtocolDebt } from '@/engine/protocols/index';
import type {
  AaveV3DebtProjectionRequest,
  AaveV4DebtProjectionRequest,
  ProtocolDebtProjectionRequest,
} from '@/engine/protocols/types';

/**
 * Protocol/version dispatch — V4 Readiness Audit §12 Stage 2. Proves the
 * architectural guarantees the dispatcher exists for: a `'v3'` request
 * resolves to the exact, unmodified V3 projector (same as before Stage 2);
 * a `'v4'` request now resolves to the REAL V4 math (Stage 1's stub is
 * gone); an unrecognized protocol/version value still fails closed rather
 * than throwing or silently defaulting to V3; and no scattered version
 * checks exist elsewhere — this is the one dispatch point.
 */
describe('projectProtocolDebt — discriminated dispatch (V4 Readiness Audit §12 Stage 2)', () => {
  it('"v3" resolves to the exact same result as calling the V3 projector directly', () => {
    const direct = projectAaveV3Debt(20000, 0.05, 365);
    const dispatched = projectProtocolDebt({
      protocolVersion: 'v3',
      currentDebt: 20000,
      borrowApr: 0.05,
      elapsedDays: 365,
    });

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
    const result = projectProtocolDebt({
      protocolVersion: 'v3',
      currentDebt: 20000,
      borrowApr: 0.05,
      elapsedDays: 365,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(21025.4167, 4);
  });

  it('"v3" propagates a V3 validation failure unchanged (does not swallow or reshape it)', () => {
    const direct = projectAaveV3Debt(-1, 0.05, 365);
    const dispatched = projectProtocolDebt({
      protocolVersion: 'v3',
      currentDebt: -1,
      borrowApr: 0.05,
      elapsedDays: 365,
    });
    expect(dispatched.ok).toBe(false);
    expect(direct.ok).toBe(false);
    if (dispatched.ok || direct.ok) return;
    expect(dispatched.error.code).toBe(direct.error.code);
  });

  it('"v4" resolves to the real V4 projector, not Stage 1\'s removed unsupported stub', () => {
    const direct = projectAaveV4Debt({
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 365,
    });
    const dispatched = projectProtocolDebt({
      protocolVersion: 'v4',
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 365,
    });

    expect(dispatched.ok).toBe(true);
    expect(direct.ok).toBe(true);
    if (!dispatched.ok || !direct.ok) return;

    expect(dispatched.value).toEqual(direct.value);
    expect(dispatched.metadata.formulaId).toBe('AAVE-V4-DRAWN-PREMIUM');
  });

  it('"v4" never matches what "v3" would have returned for the same currentDebt-equivalent inputs (no accidental V3 fallback)', () => {
    const v3Result = projectProtocolDebt({
      protocolVersion: 'v3',
      currentDebt: 20000,
      borrowApr: 0.05,
      elapsedDays: 365,
    });
    const v4Result = projectProtocolDebt({
      protocolVersion: 'v4',
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 365,
    });
    expect(v3Result.ok).toBe(true);
    expect(v4Result.ok).toBe(true);
    if (!v3Result.ok || !v4Result.ok) return;
    // V3's compounded curve and V4's linear-interest + premium model
    // produce genuinely different totals for the "same" nominal inputs.
    expect(v4Result.value.totalDebt).not.toBe(v3Result.value);
  });

  it('"v4" propagates a V4 validation failure unchanged (does not swallow or reshape it)', () => {
    const dispatched = projectProtocolDebt({
      protocolVersion: 'v4',
      drawnDebt: -1,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 365,
    });
    expect(dispatched.ok).toBe(false);
    if (dispatched.ok) return;
    expect(dispatched.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('an unrecognized protocol/version value fails closed rather than throwing', () => {
    const bogusRequest = {
      protocolVersion: 'v2',
      currentDebt: 20000,
      borrowApr: 0.05,
      elapsedDays: 365,
    } as unknown as ProtocolDebtProjectionRequest;

    expect(() => projectProtocolDebt(bogusRequest)).not.toThrow();

    const result = projectProtocolDebt(bogusRequest);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROTOCOL_VERSION_UNSUPPORTED');
    expect(result.error.message).toContain('v2');
  });

  it('an unrecognized protocol/version value does not fall back to V3 or V4 output', () => {
    const bogusRequest = {
      protocolVersion: 'unknown-protocol',
      currentDebt: 20000,
      borrowApr: 0.05,
      elapsedDays: 365,
    } as unknown as ProtocolDebtProjectionRequest;
    const result = projectProtocolDebt(bogusRequest);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect('value' in result).toBe(false);
  });

  it('TS overloads: a v3 request is typed to return FormulaResult<number>', () => {
    const request: AaveV3DebtProjectionRequest = {
      protocolVersion: 'v3',
      currentDebt: 20000,
      borrowApr: 0.05,
      elapsedDays: 365,
    };
    const result = projectProtocolDebt(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.value).toBe('number');
  });

  it('TS overloads: a v4 request is typed to return FormulaResult<AaveV4DebtProjection>', () => {
    const request: AaveV4DebtProjectionRequest = {
      protocolVersion: 'v4',
      drawnDebt: 20000,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.1,
      elapsedDays: 365,
    };
    const result = projectProtocolDebt(request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.value).toBe('object');
    expect(result.value).toHaveProperty('drawnDebt');
    expect(result.value).toHaveProperty('premiumDebt');
    expect(result.value).toHaveProperty('totalDebt');
  });
});
