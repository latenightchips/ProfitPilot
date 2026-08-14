import type { AaveAdapter, AaveAdapterResult } from '../types';
import { AAVE_V3_ETHEREUM_MARKET } from './addresses';
import {
  type AaveV3RpcClient,
  createAaveV3RpcClient,
  fetchAssetPrice,
  fetchBlockNumber,
  fetchReserveConfigurationData,
  fetchReserveData,
  fetchTokenDecimals,
} from './client';
import { mapAaveV3Snapshot } from './mapAaveV3Snapshot';
import type { RawAaveV3Snapshot } from './types';

export interface CreateAaveV3AdapterParams {
  rpcUrl: string;
}

/**
 * Fetches one internally-consistent reserve snapshot: every read (reserve
 * config, reserve data, price, and both assets' live ERC20 decimals) is
 * pinned to the same block number, fetched once up front. Decimals are
 * cross-checked against the hardcoded `AAVE_V3_ETHEREUM_ASSETS` registry
 * and fail closed on any mismatch, rather than silently proceeding with a
 * possibly-wrong scale.
 */
export async function fetchAaveV3ReserveSnapshot(
  client: AaveV3RpcClient,
): Promise<AaveAdapterResult> {
  const { collateralAsset, borrowAsset, network } = AAVE_V3_ETHEREUM_MARKET;

  const blockNumberResult = await fetchBlockNumber(client);
  if (!blockNumberResult.ok) {
    return { ok: false, error: blockNumberResult.error };
  }
  const blockNumber = blockNumberResult.data;

  const [
    collateralConfigResult,
    collateralReserveResult,
    collateralPriceResult,
    borrowReserveResult,
    collateralDecimalsResult,
    borrowDecimalsResult,
  ] = await Promise.all([
    fetchReserveConfigurationData(client, collateralAsset.address, blockNumber),
    fetchReserveData(client, collateralAsset.address, blockNumber),
    fetchAssetPrice(client, collateralAsset.address, blockNumber),
    fetchReserveData(client, borrowAsset.address, blockNumber),
    fetchTokenDecimals(client, collateralAsset.address, blockNumber),
    fetchTokenDecimals(client, borrowAsset.address, blockNumber),
  ]);

  if (!collateralConfigResult.ok) return { ok: false, error: collateralConfigResult.error };
  if (!collateralReserveResult.ok) return { ok: false, error: collateralReserveResult.error };
  if (!collateralPriceResult.ok) return { ok: false, error: collateralPriceResult.error };
  if (!borrowReserveResult.ok) return { ok: false, error: borrowReserveResult.error };
  if (!collateralDecimalsResult.ok) return { ok: false, error: collateralDecimalsResult.error };
  if (!borrowDecimalsResult.ok) return { ok: false, error: borrowDecimalsResult.error };

  if (collateralDecimalsResult.data !== collateralAsset.decimals) {
    return {
      ok: false,
      error: {
        code: 'AAVE_DECIMALS_MISMATCH',
        message: `${collateralAsset.symbol} on-chain decimals (${collateralDecimalsResult.data}) do not match the configured value (${collateralAsset.decimals}).`,
        userMessage: 'Aave asset configuration has changed unexpectedly. Please try again later.',
        retryable: false,
      },
    };
  }
  if (borrowDecimalsResult.data !== borrowAsset.decimals) {
    return {
      ok: false,
      error: {
        code: 'AAVE_DECIMALS_MISMATCH',
        message: `${borrowAsset.symbol} on-chain decimals (${borrowDecimalsResult.data}) do not match the configured value (${borrowAsset.decimals}).`,
        userMessage: 'Aave asset configuration has changed unexpectedly. Please try again later.',
        retryable: false,
      },
    };
  }

  const snapshot: RawAaveV3Snapshot = {
    blockNumber,
    collateralConfig: collateralConfigResult.data,
    collateralReserve: collateralReserveResult.data,
    collateralPrice: collateralPriceResult.data,
    borrowReserve: borrowReserveResult.data,
    collateralDecimals: collateralDecimalsResult.data,
    borrowDecimals: borrowDecimalsResult.data,
  };

  const data = mapAaveV3Snapshot(snapshot, {
    network,
    collateralSymbol: collateralAsset.symbol,
    borrowSymbol: borrowAsset.symbol,
    now: new Date().toISOString(),
  });

  return { ok: true, data };
}

export function createAaveV3Adapter(params: CreateAaveV3AdapterParams): AaveAdapter {
  const client = createAaveV3RpcClient(params.rpcUrl);
  return {
    version: 'v3',
    fetchReserveSnapshot: () => fetchAaveV3ReserveSnapshot(client),
  };
}
