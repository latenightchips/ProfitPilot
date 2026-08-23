import { ContractFunctionRevertedError } from 'viem';
import { describe, expect, it, vi } from 'vitest';

import { fetchAaveV4CollateralRiskSnapshot } from '@/infrastructure/protocols/aave/v4';
import {
  AAVE_V4_ETHEREUM_HUBS,
  AAVE_V4_ETHEREUM_SPOKE,
} from '@/infrastructure/protocols/aave/v4/addresses';
import type { AaveV4RpcClient } from '@/infrastructure/protocols/aave/v4/client';

const USER = '0x1111111111111111111111111111111111111111' as const;

/**
 * V4 Readiness Audit §12 Stage 23C — `fetchAaveV4CollateralRiskSnapshot`'s
 * own dedicated test surface, independent of `index.test.ts`'s existing
 * `fetchAaveV4DebtSnapshot` coverage (that function fetches the DEBT
 * asset's reserve; this one fetches the COLLATERAL asset's — genuinely
 * different RPC calls, verified below never to overlap).
 */
const ORACLE = '0x9999999999999999999999999999999999999999' as const;

interface MockConfig {
  blockNumber?: bigint;
  blockTimestamp?: bigint;
  assetIdListedOnHub?: `0x${string}`;
  assetId?: bigint;
  reserveId?: bigint;
  /** `ISpoke.getUserPosition`'s `dynamicConfigKey` — the user's own bound snapshot. Deliberately distinct from any reserve-level key so a substitution bug is directly observable. */
  userDynamicConfigKey?: number;
  collateralFactor?: number;
  /** `ISpoke.ORACLE()` — V4 Readiness Audit §12 P1-B. */
  oracle?: `0x${string}`;
  /** `IPriceOracle.decimals()`. */
  oracleDecimals?: number;
  /** `IPriceOracle.getReservePrice(reserveId)`, raw integer at `oracleDecimals` precision. */
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
  const userDynamicConfigKey = overrides?.userDynamicConfigKey ?? 3;
  const collateralFactor = overrides?.collateralFactor ?? 7500; // 75%
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
    if (functionName === 'ORACLE') {
      return oracle;
    }
    if (functionName === 'decimals') {
      // `IPriceOracle.decimals()` — only ever called on the oracle
      // address, never the ERC20 debt token (this path has no debt
      // token at all).
      expect(String(address).toLowerCase()).toBe(oracle.toLowerCase());
      return oracleDecimals;
    }
    if (functionName === 'getReservePrice') {
      // Proves the price read reuses the exact same reserveId already
      // resolved for getUserPosition/getDynamicReserveConfig above — no
      // separate reserve resolution.
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

describe('fetchAaveV4CollateralRiskSnapshot — happy path', () => {
  it('returns the canonical collateralFactor and the exact user-bound dynamicConfigKey', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.canonical.collateralFactor).toBeCloseTo(0.75, 10);
    expect(result.data.canonical.dynamicConfigKey).toBe(3);
    expect(result.data.canonical.collateralPriceUsd).toBe(69000);
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

    // `decimals` is deliberately NOT in this list (V4 Readiness Audit §12
    // P1-B) — it is now genuinely called here, but on the ORACLE
    // contract (`IPriceOracle.decimals()`), never the ERC20 debt token;
    // see the dedicated oracle-address assertion below.
    const calledFunctionNames = new Set(readContract.mock.calls.map(([a]) => a.functionName));
    for (const debtOnlyFn of [
      'getUserDebt',
      'getAssetDrawnRate',
      'getUserLastRiskPremium',
      'getUserReserveStatus',
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

/**
 * V4 Readiness Audit §12 P1-B — oracle price boundary. Proves the
 * `Spoke → ORACLE() → getReservePrice(collateralReserveId) → normalized
 * USD price` path this stage adds, and that it fails closed exactly like
 * every other read in this function (never a fabricated 0/$1/cached
 * price).
 */
describe('fetchAaveV4CollateralRiskSnapshot — oracle price boundary', () => {
  it('obtains the oracle address from the Spoke via ORACLE(), not a hardcoded address', async () => {
    const customOracle = '0x3333333333333333333333333333333333333333' as const;
    const { client, readContract } = buildClient({ oracle: customOracle });
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(true);

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: AAVE_V4_ETHEREUM_SPOKE, functionName: 'ORACLE' }),
    );
    // decimals()/getReservePrice() are then called against THAT
    // discovered address, not the Spoke and not a hardcoded one.
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: customOracle, functionName: 'decimals' }),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ address: customOracle, functionName: 'getReservePrice' }),
    );
  });

  it('passes the exact same collateralReserveId already resolved for getUserPosition/getDynamicReserveConfig to getReservePrice', async () => {
    const { client, readContract } = buildClient({ reserveId: 42n });
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(true);

    const getReservePriceCall = readContract.mock.calls.find(
      ([a]) => a.functionName === 'getReservePrice',
    );
    expect(getReservePriceCall?.[0].args).toEqual([42n]);
    if (result.ok) expect(result.data.raw.collateralReserveId).toBe(42n);
  });

  it('reads oracle decimals live rather than assuming a fixed precision', async () => {
    const { client, readContract } = buildClient({ oracleDecimals: 18 });
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.raw.oracleDecimals).toBe(18);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'decimals' }),
    );
  });

  it('normalizes the raw oracle price into collateralPriceUsd using the price just read, at 8-decimal precision', async () => {
    const { client } = buildClient({ oracleDecimals: 8, oraclePriceRaw: 6_900_000_000_000n });
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.canonical.collateralPriceUsd).toBe(69000);
  });

  it('normalizes correctly at a different decimal precision, proving decimals is never hardcoded', async () => {
    const { client } = buildClient({
      oracleDecimals: 18,
      oraclePriceRaw: 69_000_000_000_000_000_000_000n,
    });
    const result = await fetchAaveV4CollateralRiskSnapshot(client, USER);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.canonical.collateralPriceUsd).toBe(69000);
  });

  it('fails closed, with no fabricated price, when ORACLE() itself fails', async () => {
    const { client } = buildClient();
    const failingClient: AaveV4RpcClient = {
      getBlock: client.getBlock,
      readContract: (async (params: { functionName: string }) => {
        if (params.functionName === 'ORACLE') throw new Error('reverted');
        return (client.readContract as unknown as (p: unknown) => Promise<unknown>)(params);
      }) as unknown as AaveV4RpcClient['readContract'],
    };

    const result = await fetchAaveV4CollateralRiskSnapshot(failingClient, USER);
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('fails closed, with no fabricated price, when decimals() fails', async () => {
    const { client } = buildClient();
    const failingClient: AaveV4RpcClient = {
      getBlock: client.getBlock,
      readContract: (async (params: { functionName: string }) => {
        if (params.functionName === 'decimals') throw new Error('reverted');
        return (client.readContract as unknown as (p: unknown) => Promise<unknown>)(params);
      }) as unknown as AaveV4RpcClient['readContract'],
    };

    const result = await fetchAaveV4CollateralRiskSnapshot(failingClient, USER);
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('fails closed, with no fabricated price, when getReservePrice() fails (e.g. AaveOracle.InvalidPrice for a non-positive feed answer)', async () => {
    const { client } = buildClient();
    const failingClient: AaveV4RpcClient = {
      getBlock: client.getBlock,
      readContract: (async (params: { functionName: string }) => {
        if (params.functionName === 'getReservePrice') throw new Error('InvalidPrice reverted');
        return (client.readContract as unknown as (p: unknown) => Promise<unknown>)(params);
      }) as unknown as AaveV4RpcClient['readContract'],
    };

    const result = await fetchAaveV4CollateralRiskSnapshot(failingClient, USER);
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('never involves any V3 oracle call — V3’s getAssetPrice/BASE_CURRENCY_UNIT are never called by this V4 path', async () => {
    const { client, readContract } = buildClient();
    await fetchAaveV4CollateralRiskSnapshot(client, USER);

    const calledFunctionNames = new Set(readContract.mock.calls.map(([a]) => a.functionName));
    expect(calledFunctionNames.has('getAssetPrice')).toBe(false);
    expect(calledFunctionNames.has('BASE_CURRENCY_UNIT')).toBe(false);
  });
});
