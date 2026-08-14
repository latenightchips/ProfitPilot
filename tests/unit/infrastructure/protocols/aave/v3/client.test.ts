import { BaseError, HttpRequestError } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { AAVE_V3_ETHEREUM_ASSETS } from '@/infrastructure/protocols/aave/v3/addresses';
import {
  type AaveV3RpcClient,
  fetchAssetPrice,
  fetchBlockNumber,
  fetchReserveConfigurationData,
  fetchReserveData,
  fetchTokenDecimals,
  fetchUserAccountData,
} from '@/infrastructure/protocols/aave/v3/client';

function fakeClient(
  readContract: ReturnType<typeof vi.fn>,
  getBlockNumber?: ReturnType<typeof vi.fn>,
): AaveV3RpcClient {
  return {
    readContract: readContract as unknown as AaveV3RpcClient['readContract'],
    getBlockNumber: (getBlockNumber ?? vi.fn()) as unknown as AaveV3RpcClient['getBlockNumber'],
  };
}

describe('Aave V3 RPC client — happy paths', () => {
  it('fetches and shapes reserve configuration data', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValue([8n, 7000n, 7500n, 10500n, 1000n, true, true, false, true, false]);
    const result = await fetchReserveConfigurationData(
      fakeClient(readContract),
      AAVE_V3_ETHEREUM_ASSETS.WBTC.address,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.decimals).toBe(8n);
    expect(result.data.ltv).toBe(7000n);
    expect(result.data.liquidationThreshold).toBe(7500n);
  });

  it('fetches and shapes reserve data', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValue([
        0n,
        0n,
        1000n,
        0n,
        500n,
        20_000_000_000_000_000_000_000_000n,
        50_000_000_000_000_000_000_000_000n,
        0n,
        0n,
        1_000_000_000_000_000_000_000_000_000n,
        1_000_000_000_000_000_000_000_000_000n,
        1_700_000_000,
      ]);
    const result = await fetchReserveData(
      fakeClient(readContract),
      AAVE_V3_ETHEREUM_ASSETS.USDC.address,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.variableBorrowRate).toBe(50_000_000_000_000_000_000_000_000n);
    expect(result.data.lastUpdateTimestamp).toBe(1_700_000_000);
  });

  it('fetches asset price alongside the base currency unit', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValueOnce(6_500_000_000_000n)
      .mockResolvedValueOnce(100_000_000n);
    const result = await fetchAssetPrice(
      fakeClient(readContract),
      AAVE_V3_ETHEREUM_ASSETS.WBTC.address,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.price).toBe(6_500_000_000_000n);
    expect(result.data.baseCurrencyUnit).toBe(100_000_000n);
  });

  it('fetches user account data', async () => {
    const readContract = vi.fn().mockResolvedValue([0n, 0n, 0n, 0n, 0n, 2n ** 256n - 1n]);
    const result = await fetchUserAccountData(
      fakeClient(readContract),
      '0x0000000000000000000000000000000000000001',
    );
    expect(result.ok).toBe(true);
  });

  it('fetches live ERC20 decimals', async () => {
    const readContract = vi.fn().mockResolvedValue(6);
    const result = await fetchTokenDecimals(
      fakeClient(readContract),
      AAVE_V3_ETHEREUM_ASSETS.USDC.address,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(6);
  });

  it('fetches the current block number', async () => {
    const getBlockNumber = vi.fn().mockResolvedValue(21_000_000n);
    const result = await fetchBlockNumber(fakeClient(vi.fn(), getBlockNumber));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBe(21_000_000n);
  });

  it('passes an explicit blockNumber through to readContract for pinning', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValue([8n, 7000n, 7500n, 10500n, 1000n, true, true, false, true, false]);
    await fetchReserveConfigurationData(
      fakeClient(readContract),
      AAVE_V3_ETHEREUM_ASSETS.WBTC.address,
      21_000_000n,
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ blockNumber: 21_000_000n }),
    );
  });
});

describe('Aave V3 RPC client — error classification', () => {
  it('classifies a network failure as retryable even when readContract wraps it several levels deep', async () => {
    const httpCause = new HttpRequestError({ url: 'https://x', status: 403, body: {} });
    const middleCause = new BaseError('Call execution failed.', { cause: httpCause });
    const outer = new BaseError('Contract function execution failed.', { cause: middleCause });
    const readContract = vi.fn().mockRejectedValue(outer);
    const result = await fetchReserveConfigurationData(
      fakeClient(readContract),
      AAVE_V3_ETHEREUM_ASSETS.WBTC.address,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_RPC_NETWORK_ERROR');
    expect(result.error.retryable).toBe(true);
  });

  it('classifies a genuine contract-level failure (no network cause anywhere in the chain) as non-retryable', async () => {
    const outer = new BaseError('execution reverted: asset not listed', {
      cause: new Error('revert reason string'),
    });
    const readContract = vi.fn().mockRejectedValue(outer);
    const result = await fetchReserveConfigurationData(
      fakeClient(readContract),
      AAVE_V3_ETHEREUM_ASSETS.WBTC.address,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_RPC_CONTRACT_ERROR');
    expect(result.error.retryable).toBe(false);
  });

  it('classifies a non-BaseError throwable (e.g. a plain Error) as an unknown error', async () => {
    const readContract = vi.fn().mockRejectedValue(new Error('something else broke'));
    const result = await fetchReserveConfigurationData(
      fakeClient(readContract),
      AAVE_V3_ETHEREUM_ASSETS.WBTC.address,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_RPC_UNKNOWN_ERROR');
    expect(result.error.retryable).toBe(false);
  });

  it('classifies a block-number fetch failure the same way', async () => {
    const getBlockNumber = vi
      .fn()
      .mockRejectedValue(new BaseError('timeout', { cause: new Error('timed out') }));
    const result = await fetchBlockNumber(fakeClient(vi.fn(), getBlockNumber));
    expect(result.ok).toBe(false);
  });
});
