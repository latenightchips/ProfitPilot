import { ContractFunctionRevertedError } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { fetchAaveV4CollateralRiskSnapshot } from '@/infrastructure/protocols/aave/v4';
import { AAVE_V4_ETHEREUM_HUBS } from '@/infrastructure/protocols/aave/v4/addresses';
import type { AaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';

const USER = '0x1111111111111111111111111111111111111111' as const;

/**
 * V4 Readiness Audit §12 Stage 23C — `fetchAaveV4CollateralRiskSnapshot`'s
 * own dedicated test surface, independent of `index.test.ts`'s existing
 * `fetchAaveV4DebtSnapshot` coverage (that function fetches the DEBT
 * asset's reserve; this one fetches the COLLATERAL asset's — genuinely
 * different RPC calls, verified below never to overlap).
 */
interface MockConfig {
  blockNumber?: bigint;
  blockTimestamp?: bigint;
  assetIdListedOnHub?: `0x${string}`;
  assetId?: bigint;
  reserveId?: bigint;
  /** `ISpoke.getUserPosition`'s `dynamicConfigKey` — the user's own bound snapshot. Deliberately distinct from any reserve-level key so a substitution bug is directly observable. */
  userDynamicConfigKey?: number;
  collateralFactor?: number;
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
  const userDynamicConfigKey = overrides?.userDynamicConfigKey ?? 3;
  const collateralFactor = overrides?.collateralFactor ?? 7500; // 75%

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
    if (functionName === 'getUserPosition') {
      return {
        drawnShares: 0n,
        premiumShares: 0n,
        premiumOffsetRay: 0n,
        suppliedShares: 100_000_000n,
        dynamicConfigKey: userDynamicConfigKey,
      };
    }
    if (functionName === 'getDynamicReserveConfig') {
      // Proves the call was made with exactly the key `getUserPosition`
      // returned, not any other value.
      expect(args[1]).toBe(userDynamicConfigKey);
      return { collateralFactor, maxLiquidationBonus: 105_00, liquidationFee: 500 };
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

describe('fetchAaveV4CollateralRiskSnapshot — happy path', () => {
  it('returns the canonical collateralFactor and the exact user-bound dynamicConfigKey', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.canonical.collateralFactor).toBeCloseTo(0.75, 10);
    expect(result.data.canonical.dynamicConfigKey).toBe(3);
    expect(result.data.display.collateralSymbol).toBe('WBTC');
    expect(result.data.display.blockNumber).toBe('21000000');
  });

  it('calls getUserPosition before getDynamicReserveConfig, in that exact order', async () => {
    const { client, readContract } = buildClient();
    await fetchAaveV4CollateralRiskSnapshot(client, USER);

    const relevantCalls = readContract.mock.calls
      .map(([a]) => a.functionName)
      .filter((name) => name === 'getUserPosition' || name === 'getDynamicReserveConfig');
    expect(relevantCalls).toEqual(['getUserPosition', 'getDynamicReserveConfig']);
  });

  it('resolves the COLLATERAL asset reserve, not any debt-asset reserve, and never calls debt-specific reads', async () => {
    const { client, readContract } = buildClient();
    await fetchAaveV4CollateralRiskSnapshot(client, USER);

    const calledFunctionNames = new Set(readContract.mock.calls.map(([a]) => a.functionName));
    for (const debtOnlyFn of [
      'getUserDebt',
      'getAssetDrawnRate',
      'getUserLastRiskPremium',
      'getUserReserveStatus',
      'decimals',
      'getReserve',
    ]) {
      expect(calledFunctionNames.has(debtOnlyFn)).toBe(false);
    }
  });
});

describe('fetchAaveV4CollateralRiskSnapshot — never substitutes the user-bound key', () => {
  it('uses a different dynamicConfigKey per user without ever falling back to a hardcoded/reserve-level default', async () => {
    const { client: clientA } = buildClient({ userDynamicConfigKey: 1, collateralFactor: 8000 });
    const resultA = await fetchAaveV4CollateralRiskSnapshot(clientA, USER);
    expect(resultA.ok).toBe(true);
    if (resultA.ok) expect(resultA.data.canonical.dynamicConfigKey).toBe(1);

    const { client: clientB } = buildClient({ userDynamicConfigKey: 42, collateralFactor: 6000 });
    const resultB = await fetchAaveV4CollateralRiskSnapshot(clientB, USER);
    expect(resultB.ok).toBe(true);
    if (resultB.ok) expect(resultB.data.canonical.dynamicConfigKey).toBe(42);
  });

  it('fails closed rather than substituting any key when getUserPosition itself fails — getDynamicReserveConfig is never called', async () => {
    const { client } = buildClient();
    const readContract = vi.fn().mockImplementation(async (params: { functionName: string }) => {
      if (params.functionName === 'getUserPosition') throw new Error('reverted');
      return (client.readContract as unknown as (p: unknown) => Promise<unknown>)(params);
    });
    const failingClient: AaveV4RpcClient = {
      getBlock: client.getBlock,
      readContract: readContract as unknown as AaveV4RpcClient['readContract'],
    };

    const result = await fetchAaveV4CollateralRiskSnapshot(failingClient, USER);
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);

    expect(readContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'getDynamicReserveConfig' }),
    );
  });

  it('fails closed, not with a fabricated collateralFactor, when getDynamicReserveConfig itself fails', async () => {
    const { client } = buildClient();
    const failingClient: AaveV4RpcClient = {
      getBlock: client.getBlock,
      readContract: (async (params: { functionName: string }) => {
        if (params.functionName === 'getDynamicReserveConfig') throw new Error('reverted');
        return (client.readContract as unknown as (p: unknown) => Promise<unknown>)(params);
      }) as unknown as AaveV4RpcClient['readContract'],
    };

    const result = await fetchAaveV4CollateralRiskSnapshot(failingClient, USER);
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });
});

describe('fetchAaveV4CollateralRiskSnapshot — malformed/partial contract response', () => {
  it('propagates a block fetch failure without attempting any reads', async () => {
    const getBlock = vi.fn().mockRejectedValue(new Error('rpc unreachable'));
    const readContract = vi.fn();
    const client: AaveV4RpcClient = {
      readContract: readContract as unknown as AaveV4RpcClient['readContract'],
      getBlock: getBlock as unknown as AaveV4RpcClient['getBlock'],
    };
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it('fails closed with AAVE_V4_RESERVE_NOT_FOUND when no candidate Hub lists the collateral asset', async () => {
    const { client } = buildClient({
      assetIdListedOnHub: '0x000000000000000000000000000000000000ff',
    });
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_V4_RESERVE_NOT_FOUND');
  });
});

describe('fetchAaveV4CollateralRiskSnapshot — a zero/uninitialized config is real data, not a failure', () => {
  it('returns ok:true with collateralFactor 0 when ISpoke.getDynamicReserveConfig returns a zeroed struct (does not revert for an unset key, per its own doc comment)', async () => {
    const { client } = buildClient({ collateralFactor: 0, userDynamicConfigKey: 0 });
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.canonical.collateralFactor).toBe(0);
    expect(result.data.canonical.dynamicConfigKey).toBe(0);
  });
});

describe('fetchAaveV4CollateralRiskSnapshot — same-block enforcement', () => {
  it('pins every read to the block number fetched at the start', async () => {
    const { client, readContract, getBlock } = buildClient({ blockNumber: 22_222_222n });
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(true);

    expect(getBlock).toHaveBeenCalledTimes(1);
    expect(readContract).toHaveBeenCalled();
    for (const call of readContract.mock.calls) {
      expect(call[0]).toMatchObject({ blockNumber: 22_222_222n });
    }
  });

  it('supports pinning to an explicit historical block, skipping the latest-block fetch', async () => {
    const { client, getBlock } = buildClient();
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER, 18_500_000n);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.display.blockNumber).toBe('18500000');
    expect(getBlock).toHaveBeenCalledWith({ blockNumber: 18_500_000n });
  });
});
