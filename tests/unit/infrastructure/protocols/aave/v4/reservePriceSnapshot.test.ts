import { ContractFunctionRevertedError } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { fetchAaveV4ReservePrice } from '@/infrastructure/protocols/aave/v4';
import { AAVE_V4_ETHEREUM_HUBS } from '@/infrastructure/protocols/aave/v4/addresses';
import type { AaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';

/**
 * V4 wallet-independent price fix — `fetchAaveV4ReservePrice`'s own
 * dedicated test surface, mirroring `collateralRiskSnapshot.test.ts`'s
 * mocking convention exactly, one concern narrower: this function takes
 * NO `userAddress` parameter at all, and the central claim under test is
 * that it never calls `getUserPosition`/`getDynamicReserveConfig` —
 * verified directly by making the mock throw if either is ever invoked,
 * not merely by omitting them from the mock's happy-path branches.
 */
const ORACLE = '0x9999999999999999999999999999999999999999' as const;

interface MockConfig {
  blockNumber?: bigint;
  blockTimestamp?: bigint;
  assetIdListedOnHub?: `0x${string}`;
  assetId?: bigint;
  reserveId?: bigint;
  oracle?: `0x${string}`;
  oracleDecimals?: number;
  oraclePriceRaw?: bigint;
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
  const oracle = overrides?.oracle ?? ORACLE;
  const oracleDecimals = overrides?.oracleDecimals ?? 8;
  const oraclePriceRaw = overrides?.oraclePriceRaw ?? 6_900_000_000_000n; // $69,000 at 8 decimals

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
    if (functionName === 'getUserPosition' || functionName === 'getDynamicReserveConfig') {
      throw new Error(
        `${functionName} must never be called by fetchAaveV4ReservePrice — it takes no userAddress`,
      );
    }
    if (functionName === 'ORACLE') {
      return oracle;
    }
    if (functionName === 'decimals') {
      expect(String(address).toLowerCase()).toBe(oracle.toLowerCase());
      return oracleDecimals;
    }
    if (functionName === 'getReservePrice') {
      expect(args[0]).toBe(reserveId);
      return oraclePriceRaw;
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

describe('fetchAaveV4ReservePrice — happy path', () => {
  it('returns the canonical collateralPriceUsd with no userAddress parameter at all', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV4ReservePrice(client);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.canonical.collateralPriceUsd).toBe(69000);
    expect(result.data.display.collateralSymbol).toBe('WBTC');
    expect(result.data.display.blockNumber).toBe('21000000');
  });

  it('never calls getUserPosition or getDynamicReserveConfig — proven by the mock throwing if either fires', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV4ReservePrice(client);
    expect(result.ok).toBe(true);
  });

  it('reuses the exact reserveId already resolved for the price read, no separate resolution', async () => {
    const { client, readContract } = buildClient({ reserveId: 42n });
    await fetchAaveV4ReservePrice(client);
    const priceCall = readContract.mock.calls.find(
      ([params]) => params.functionName === 'getReservePrice',
    );
    expect(priceCall?.[0].args[0]).toBe(42n);
  });

  it('accepts an explicit pinnedBlockNumber, pinning every read to it', async () => {
    const { client, getBlock } = buildClient();
    await fetchAaveV4ReservePrice(client, 20_000_000n);
    expect(getBlock).toHaveBeenCalledWith({ blockNumber: 20_000_000n });
  });
});

describe('fetchAaveV4ReservePrice — fails closed, no fallback', () => {
  it('fails closed when no Hub lists the collateral asset (AAVE_V4_RESERVE_NOT_FOUND)', async () => {
    const { client } = buildClient({
      assetIdListedOnHub: '0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead',
    });
    const result = await fetchAaveV4ReservePrice(client);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_RESERVE_NOT_FOUND');
  });

  it('fails closed if the oracle address read fails', async () => {
    const { client, readContract } = buildClient();
    readContract.mockImplementation(async ({ functionName }) => {
      if (functionName === 'getAssetId') return 7n;
      if (functionName === 'getReserveId') return 11n;
      if (functionName === 'ORACLE') throw new Error('RPC failure');
      throw new Error(`Unexpected functionName in test: ${functionName}`);
    });
    const result = await fetchAaveV4ReservePrice(client);
    expect(result.ok).toBe(false);
  });

  it('fails closed if the reserve price read fails, never substituting V3 data or a fabricated value', async () => {
    const { client, readContract } = buildClient();
    readContract.mockImplementation(async ({ functionName, address }) => {
      if (functionName === 'getAssetId') return 7n;
      if (functionName === 'getReserveId') return 11n;
      if (functionName === 'ORACLE') return ORACLE;
      if (functionName === 'decimals') return 8;
      if (functionName === 'getReservePrice') throw new Error('RPC failure');
      throw new Error(`Unexpected functionName in test: ${functionName}, address=${address}`);
    });
    const result = await fetchAaveV4ReservePrice(client);
    expect(result.ok).toBe(false);
  });
});
