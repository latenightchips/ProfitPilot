import { describe, expect, it, vi } from 'vitest';

import { fetchAaveV3ReserveSnapshot } from '@/infrastructure/protocols/aave/v3';
import { AAVE_V3_ETHEREUM_ASSETS } from '@/infrastructure/protocols/aave/v3/addresses';
import type { AaveV3RpcClient } from '@/infrastructure/protocols/aave/v3/client';

const CONFIG_RESULT = [8n, 7000n, 7500n, 10500n, 1000n, true, true, false, true, false];
const RESERVE_RESULT = [
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
];

/**
 * Routes readContract calls by functionName + address so every snapshot
 * piece is independently mockable. USDT Support milestone: decimals
 * override keys are now by asset symbol (`decimals: { WBTC, USDC, USDT }`)
 * rather than a WBTC-vs-"everything else" boolean, matched against the
 * real registry addresses rather than a hardcoded substring — the same
 * routing a third (or future) borrow asset needs, not a special case for
 * USDT specifically.
 */
function buildClient(overrides?: {
  decimals?: Partial<Record<keyof typeof AAVE_V3_ETHEREUM_ASSETS, number>>;
  blockNumber?: bigint;
}): { client: AaveV3RpcClient; readContract: ReturnType<typeof vi.fn> } {
  const blockNumber = overrides?.blockNumber ?? 21_000_000n;
  const getBlockNumber = vi.fn().mockResolvedValue(blockNumber);

  const readContract = vi.fn().mockImplementation(async ({ functionName, address }) => {
    if (functionName === 'getReserveConfigurationData') return CONFIG_RESULT;
    if (functionName === 'getReserveData') return RESERVE_RESULT;
    if (functionName === 'getAssetPrice') return 6_500_000_000_000n;
    if (functionName === 'BASE_CURRENCY_UNIT') return 100_000_000n;
    if (functionName === 'decimals') {
      const asset = Object.values(AAVE_V3_ETHEREUM_ASSETS).find(
        (candidate) => candidate.address.toLowerCase() === String(address).toLowerCase(),
      );
      if (asset === undefined) throw new Error(`Unexpected decimals() address in test: ${address}`);
      return overrides?.decimals?.[asset.symbol as keyof typeof AAVE_V3_ETHEREUM_ASSETS] ??
        asset.decimals;
    }
    throw new Error(`Unexpected functionName in test: ${functionName}`);
  });

  return {
    client: {
      readContract: readContract as unknown as AaveV3RpcClient['readContract'],
      getBlockNumber: getBlockNumber as unknown as AaveV3RpcClient['getBlockNumber'],
    },
    readContract,
  };
}

describe('fetchAaveV3ReserveSnapshot — USDC (unchanged behavior)', () => {
  it('returns a full snapshot when every read succeeds and decimals match', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV3ReserveSnapshot(client, 'USDC');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source.blockNumber).toBe('21000000');
    expect(result.data.priceCandidate.price).toBe(65000);
    expect(result.data.borrowSymbol).toBe('USDC');
  });

  it('pins every subsequent read to the block number fetched at the start of the snapshot', async () => {
    const { client, readContract } = buildClient({ blockNumber: 22_222_222n });
    const result = await fetchAaveV3ReserveSnapshot(client, 'USDC');
    expect(result.ok).toBe(true);

    // Every readContract call (config x1, reserve x2, price x2, decimals x2 = 7 calls) must carry the pinned block.
    expect(readContract).toHaveBeenCalled();
    for (const call of readContract.mock.calls) {
      expect(call[0]).toMatchObject({ blockNumber: 22_222_222n });
    }
  });

  it('fails closed with AAVE_DECIMALS_MISMATCH when the live WBTC decimals disagree with the hardcoded registry, without silently proceeding', async () => {
    const { client } = buildClient({ decimals: { WBTC: 18 } });
    const result = await fetchAaveV3ReserveSnapshot(client, 'USDC');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_DECIMALS_MISMATCH');
    expect(result.error.retryable).toBe(false);
  });

  it('fails closed with AAVE_DECIMALS_MISMATCH when the live USDC decimals disagree with the hardcoded registry', async () => {
    const { client } = buildClient({ decimals: { USDC: 18 } });
    const result = await fetchAaveV3ReserveSnapshot(client, 'USDC');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_DECIMALS_MISMATCH');
  });

  it('propagates a block-number fetch failure without attempting any further reads', async () => {
    const getBlockNumber = vi.fn().mockRejectedValue(new Error('rpc unreachable'));
    const readContract = vi.fn();
    const client: AaveV3RpcClient = {
      readContract: readContract as unknown as AaveV3RpcClient['readContract'],
      getBlockNumber: getBlockNumber as unknown as AaveV3RpcClient['getBlockNumber'],
    };
    const result = await fetchAaveV3ReserveSnapshot(client, 'USDC');
    expect(result.ok).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it('propagates a single-field RPC failure (e.g. price read) as the adapter error', async () => {
    const { client, readContract } = buildClient();
    readContract.mockImplementation(async ({ functionName }) => {
      if (functionName === 'getAssetPrice') throw new Error('reverted');
      if (functionName === 'getReserveConfigurationData') return CONFIG_RESULT;
      if (functionName === 'getReserveData') return RESERVE_RESULT;
      if (functionName === 'BASE_CURRENCY_UNIT') return 100_000_000n;
      if (functionName === 'decimals') return 8;
      throw new Error('unexpected');
    });
    const result = await fetchAaveV3ReserveSnapshot(client, 'USDC');
    expect(result.ok).toBe(false);
  });
});

describe('fetchAaveV3ReserveSnapshot — USDT (USDT Support milestone)', () => {
  it('returns a full snapshot for the USDT reserve, addressed and labeled distinctly from USDC', async () => {
    const { client, readContract } = buildClient();
    const result = await fetchAaveV3ReserveSnapshot(client, 'USDT');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.borrowSymbol).toBe('USDT');
    expect(result.data.collateralSymbol).toBe('WBTC');

    // The borrow-side `getReserveData` read must carry USDT's own address
    // as its contract *argument* (both reserve reads target the same
    // `poolDataProvider` contract `address`; the asset itself is
    // `args.args[0]`) — proves the lookup is genuinely asset-driven, not
    // coincidentally always resolving to USDC.
    const reserveDataCalls = readContract.mock.calls.filter(
      ([args]) => args.functionName === 'getReserveData',
    );
    const reserveDataAssetAddresses = reserveDataCalls.map(([args]) =>
      String(args.args?.[0]).toLowerCase(),
    );
    expect(reserveDataAssetAddresses).toContain(AAVE_V3_ETHEREUM_ASSETS.USDT.address.toLowerCase());
    expect(reserveDataAssetAddresses).not.toContain(
      AAVE_V3_ETHEREUM_ASSETS.USDC.address.toLowerCase(),
    );
  });

  it('fails closed with AAVE_DECIMALS_MISMATCH when live USDT decimals disagree with the registry — not silently assumed equal to USDC', async () => {
    const { client } = buildClient({ decimals: { USDT: 18 } });
    const result = await fetchAaveV3ReserveSnapshot(client, 'USDT');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_DECIMALS_MISMATCH');
    expect(result.error.message).toContain('USDT');
  });
});

describe('fetchAaveV3ReserveSnapshot — unsupported borrow asset (USDT Support milestone)', () => {
  it('fails closed with AAVE_UNSUPPORTED_BORROW_ASSET for DAI, without attempting any RPC reads or substituting USDC', async () => {
    const { client, readContract } = buildClient();
    const result = await fetchAaveV3ReserveSnapshot(client, 'DAI');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_UNSUPPORTED_BORROW_ASSET');
    expect(result.error.retryable).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it('fails closed with AAVE_UNSUPPORTED_BORROW_ASSET for an unrecognized symbol', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV3ReserveSnapshot(client, 'NOT_A_REAL_ASSET');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_UNSUPPORTED_BORROW_ASSET');
  });
});
