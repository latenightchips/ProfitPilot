import { ContractFunctionRevertedError } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { fetchAaveV4BaseDrawnRate } from '@/infrastructure/protocols/aave/v4';
import { AAVE_V4_ETHEREUM_HUBS } from '@/infrastructure/protocols/aave/v4/addresses';
import type { AaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';

/**
 * V4 Manual-Data / Provenance Audit — wallet-independent base drawn rate.
 * `fetchAaveV4BaseDrawnRate`'s own dedicated test surface, mirroring
 * `reservePriceSnapshot.test.ts`'s mocking convention exactly, one
 * concern narrower: this function takes NO `userAddress` parameter at
 * all, and the central claim under test is that it never calls
 * `getUserDebt`/`getUserLastRiskPremium`/`getUserReserveStatus` —
 * verified directly by making the mock throw if any of them is ever
 * invoked, not merely by omitting them from the mock's happy-path
 * branches.
 */
interface MockConfig {
  blockNumber?: bigint;
  blockTimestamp?: bigint;
  assetIdListedOnHub?: `0x${string}`;
  assetId?: bigint;
  reserveId?: bigint;
  drawnRateRay?: bigint;
}

function notListedError(): ContractFunctionRevertedError {
  const err = new ContractFunctionRevertedError({ abi: [], functionName: 'x' });
  // @ts-expect-error -- `data` is writable at runtime; viem's own decoder assigns it the same way.
  err.data = { errorName: 'AssetNotListed', args: [] };
  return err;
}

function buildClient(overrides?: MockConfig): {
  client: AaveV4RpcClient;
  readContract: ReturnType<typeof vi.fn>;
  getBlock: ReturnType<typeof vi.fn>;
} {
  const blockNumber = overrides?.blockNumber ?? 21_000_000n;
  const blockTimestamp = overrides?.blockTimestamp ?? 1_700_000_000n;
  const assetIdListedOnHub =
    overrides?.assetIdListedOnHub ?? (AAVE_V4_ETHEREUM_HUBS.CORE as `0x${string}`);
  const assetId = overrides?.assetId ?? 7n;
  const reserveId = overrides?.reserveId ?? 11n;
  const drawnRateRay = overrides?.drawnRateRay ?? 40_000_000_000_000_000_000_000_000n; // 4% APR

  const getBlock = vi.fn().mockImplementation(async (params?: { blockNumber?: bigint }) => {
    if (params?.blockNumber !== undefined) {
      return { number: params.blockNumber, timestamp: blockTimestamp };
    }
    return { number: blockNumber, timestamp: blockTimestamp };
  });

  const readContract = vi.fn().mockImplementation(async ({ functionName, address, args }) => {
    if (functionName === 'getAssetId') {
      if (String(address).toLowerCase() === assetIdListedOnHub.toLowerCase()) {
        return assetId;
      }
      throw notListedError();
    }
    if (functionName === 'getReserveId') {
      return reserveId;
    }
    if (
      functionName === 'getUserDebt' ||
      functionName === 'getUserLastRiskPremium' ||
      functionName === 'getUserReserveStatus' ||
      functionName === 'getUserPosition'
    ) {
      throw new Error(
        `${functionName} must never be called by fetchAaveV4BaseDrawnRate — it takes no userAddress`,
      );
    }
    if (functionName === 'getAssetDrawnRate') {
      expect(args[0]).toBe(assetId);
      return drawnRateRay;
    }
    throw new Error(`Unexpected functionName in test: ${functionName}`);
  });

  return {
    client: {
      readContract: readContract as unknown as AaveV4RpcClient['readContract'],
      getBlock: getBlock as unknown as AaveV4RpcClient['getBlock'],
    },
    readContract,
    getBlock,
  };
}

describe('fetchAaveV4BaseDrawnRate — happy path', () => {
  it('returns the canonical baseDrawnApr with no userAddress parameter at all', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV4BaseDrawnRate(client, 'USDC');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.canonical.baseDrawnApr).toBeCloseTo(0.04);
    expect(result.data.display.debtSymbol).toBe('USDC');
    expect(result.data.display.blockNumber).toBe('21000000');
  });

  it('never calls getUserDebt, getUserLastRiskPremium, or getUserReserveStatus — proven by the mock throwing if any fires', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV4BaseDrawnRate(client, 'USDC');
    expect(result.ok).toBe(true);
  });

  it('reuses the exact assetId already resolved for the rate read, no separate resolution', async () => {
    const { client, readContract } = buildClient({ assetId: 42n });
    await fetchAaveV4BaseDrawnRate(client, 'USDC');
    const rateCall = readContract.mock.calls.find(
      ([params]) => params.functionName === 'getAssetDrawnRate',
    );
    expect(rateCall?.[0].args[0]).toBe(42n);
  });

  it('accepts an explicit pinnedBlockNumber, pinning every read to it', async () => {
    const { client, getBlock } = buildClient();
    await fetchAaveV4BaseDrawnRate(client, 'USDC', 20_000_000n);
    expect(getBlock).toHaveBeenCalledWith({ blockNumber: 20_000_000n });
  });
});

describe('fetchAaveV4BaseDrawnRate — fails closed, no fallback', () => {
  it('fails closed for an unsupported debt asset symbol (AAVE_V4_UNSUPPORTED_DEBT_ASSET), never reaching the RPC', async () => {
    const { client, readContract } = buildClient();
    const result = await fetchAaveV4BaseDrawnRate(client, 'DAI');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_UNSUPPORTED_DEBT_ASSET');
    expect(readContract).not.toHaveBeenCalled();
  });

  it('fails closed when no Hub lists the debt asset (AAVE_V4_RESERVE_NOT_FOUND)', async () => {
    const { client } = buildClient({
      assetIdListedOnHub: '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead',
    });
    const result = await fetchAaveV4BaseDrawnRate(client, 'USDC');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_RESERVE_NOT_FOUND');
  });

  it('fails closed if the drawn-rate read fails, never substituting V3 data or a fabricated value', async () => {
    const { client, readContract } = buildClient();
    readContract.mockImplementation(async ({ functionName }) => {
      if (functionName === 'getAssetId') return 7n;
      if (functionName === 'getReserveId') return 11n;
      if (functionName === 'getAssetDrawnRate') throw new Error('RPC failure');
      throw new Error(`Unexpected functionName in test: ${functionName}`);
    });
    const result = await fetchAaveV4BaseDrawnRate(client, 'USDC');
    expect(result.ok).toBe(false);
  });
});
