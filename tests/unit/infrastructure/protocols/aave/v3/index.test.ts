import { describe, expect, it, vi } from 'vitest';

import { fetchAaveV3ReserveSnapshot } from '@/infrastructure/protocols/aave/v3';
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

/** Routes readContract calls by functionName + address so every snapshot piece is independently mockable. */
function buildClient(overrides?: {
  wbtcDecimals?: number;
  usdcDecimals?: number;
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
      const isWbtc = String(address).toLowerCase().includes('2260fac5');
      return isWbtc ? (overrides?.wbtcDecimals ?? 8) : (overrides?.usdcDecimals ?? 6);
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

describe('fetchAaveV3ReserveSnapshot — block-pinned, decimals-cross-checked orchestration', () => {
  it('returns a full snapshot when every read succeeds and decimals match', async () => {
    const { client } = buildClient();
    const result = await fetchAaveV3ReserveSnapshot(client);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.source.blockNumber).toBe('21000000');
    expect(result.data.priceCandidate.price).toBe(65000);
  });

  it('pins every subsequent read to the block number fetched at the start of the snapshot', async () => {
    const { client, readContract } = buildClient({ blockNumber: 22_222_222n });
    const result = await fetchAaveV3ReserveSnapshot(client);
    expect(result.ok).toBe(true);

    // Every readContract call (config x1, reserve x2, price x2, decimals x2 = 7 calls) must carry the pinned block.
    expect(readContract).toHaveBeenCalled();
    for (const call of readContract.mock.calls) {
      expect(call[0]).toMatchObject({ blockNumber: 22_222_222n });
    }
  });

  it('fails closed with AAVE_DECIMALS_MISMATCH when the live WBTC decimals disagree with the hardcoded registry, without silently proceeding', async () => {
    const { client } = buildClient({ wbtcDecimals: 18 });
    const result = await fetchAaveV3ReserveSnapshot(client);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_DECIMALS_MISMATCH');
    expect(result.error.retryable).toBe(false);
  });

  it('fails closed with AAVE_DECIMALS_MISMATCH when the live USDC decimals disagree with the hardcoded registry', async () => {
    const { client } = buildClient({ usdcDecimals: 18 });
    const result = await fetchAaveV3ReserveSnapshot(client);
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
    const result = await fetchAaveV3ReserveSnapshot(client);
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
    const result = await fetchAaveV3ReserveSnapshot(client);
    expect(result.ok).toBe(false);
  });
});
