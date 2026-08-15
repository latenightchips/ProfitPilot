import { describe, expect, it } from 'vitest';

import {
  mapAaveV4AdapterFailure,
  validateAaveV4LivePositionRequest,
} from '@/services/aave/v4LivePosition';

/**
 * Aave V4 Live Position Service — V4 Readiness Audit §12 Stage 4B.
 *
 * Both functions here are pure (no RPC, no infra import — see the source
 * file's own header comment for why), so this suite tests them directly
 * with no mocking, the same style `tests/unit/services/protocol/quote.test.ts`
 * already uses for its own pure Service function.
 */
const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

describe('validateAaveV4LivePositionRequest (Stage 4B)', () => {
  it('fails closed with a distinct code when v4Position is missing entirely', () => {
    const result = validateAaveV4LivePositionRequest({ debtAssetSymbol: 'USDC' });

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
    const result = validateAaveV4LivePositionRequest({
      v4Position: { userAddress: 'not-an-address' as `0x${string}` },
      debtAssetSymbol: 'USDC',
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
    const result = validateAaveV4LivePositionRequest({
      v4Position: { userAddress: VALID_ADDRESS.slice(2) as `0x${string}` },
      debtAssetSymbol: 'USDC',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('AAVE_V4_INVALID_USER_ADDRESS');
  });

  it('succeeds for a well-formed v4Position and threads debtAssetSymbol through unchanged, for a supported asset (USDC)', () => {
    const result = validateAaveV4LivePositionRequest({
      v4Position: { userAddress: VALID_ADDRESS as `0x${string}` },
      debtAssetSymbol: 'USDC',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ userAddress: VALID_ADDRESS, debtAssetSymbol: 'USDC' });
  });

  it('succeeds for a well-formed v4Position and the other supported asset (USDT)', () => {
    const result = validateAaveV4LivePositionRequest({
      v4Position: { userAddress: VALID_ADDRESS as `0x${string}` },
      debtAssetSymbol: 'USDT',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtAssetSymbol).toBe('USDT');
  });

  it('does not itself reject an unsupported debt asset symbol — that check belongs to the adapter, not this Service', () => {
    const result = validateAaveV4LivePositionRequest({
      v4Position: { userAddress: VALID_ADDRESS as `0x${string}` },
      debtAssetSymbol: 'DAI',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.debtAssetSymbol).toBe('DAI');
  });
});

describe('mapAaveV4AdapterFailure (Stage 4B)', () => {
  it('converts an adapter failure into a provider-category ApplicationError, preserving the code and using userMessage (never the internal message)', () => {
    const applicationError = mapAaveV4AdapterFailure({
      code: 'AAVE_V4_RPC_NETWORK_ERROR',
      userMessage: 'Could not reach the Ethereum RPC endpoint. Please try again.',
    });

    expect(applicationError).toEqual({
      category: 'provider',
      code: 'AAVE_V4_RPC_NETWORK_ERROR',
      message: 'Could not reach the Ethereum RPC endpoint. Please try again.',
    });
  });

  it('preserves an unsupported-debt-asset adapter code unchanged, for the route to map to 400', () => {
    const applicationError = mapAaveV4AdapterFailure({
      code: 'AAVE_V4_UNSUPPORTED_DEBT_ASSET',
      userMessage: 'Live Aave V4 data is not yet available for DAI.',
    });

    expect(applicationError.code).toBe('AAVE_V4_UNSUPPORTED_DEBT_ASSET');
    expect(applicationError.category).toBe('provider');
  });
});
