import { describe, expect, it } from 'vitest';

import { validateAaveV4CollateralRiskRequest } from '@/services/aave/v4CollateralRisk';

/**
 * Aave V4 Live Collateral-Risk Service — V4 Readiness Audit §12 Stage
 * 23F. Pure (no RPC, no infra import — see the source file's own header
 * comment for why), so this suite tests it directly with no mocking, the
 * same style `tests/unit/services/aave/v4LivePosition.test.ts` already
 * uses for its own pure Service function.
 */
const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

describe('validateAaveV4CollateralRiskRequest (Stage 23F)', () => {
  it('fails closed with a distinct code when v4Position is missing entirely', () => {
    const result = validateAaveV4CollateralRiskRequest({});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      {
        category: 'validation',
        code: 'AAVE_V4_MISSING_POSITION_IDENTITY',
        message: 'This portfolio has no Aave V4 wallet address configured.',
      },
    ]);
  });

  it('fails closed with a distinct code when the configured userAddress is malformed', () => {
    const result = validateAaveV4CollateralRiskRequest({
      v4Position: { userAddress: 'not-an-address' as `0x${string}` },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      {
        category: 'validation',
        code: 'AAVE_V4_INVALID_USER_ADDRESS',
        message: 'The configured Aave V4 wallet address is not valid.',
      },
    ]);
  });

  it('fails closed when userAddress is missing the 0x prefix', () => {
    const result = validateAaveV4CollateralRiskRequest({
      v4Position: { userAddress: VALID_ADDRESS.slice(2) as `0x${string}` },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('AAVE_V4_INVALID_USER_ADDRESS');
  });

  it('succeeds for a well-formed v4Position, requiring no debtAssetSymbol at all (unlike validateAaveV4LivePositionRequest)', () => {
    const result = validateAaveV4CollateralRiskRequest({
      v4Position: { userAddress: VALID_ADDRESS as `0x${string}` },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ userAddress: VALID_ADDRESS });
  });
});
