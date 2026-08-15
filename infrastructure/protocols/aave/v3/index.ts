import type { AaveAdapter, AaveAdapterResult } from '../types';
import {
  AAVE_V3_ETHEREUM_BORROW_ASSETS,
  AAVE_V3_ETHEREUM_MARKET,
  type AaveV3LiveBorrowAssetSymbol,
} from './addresses';
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
 * Table-driven guard (USDT Support milestone): true exactly when `symbol`
 * is a key of the `AAVE_V3_ETHEREUM_BORROW_ASSETS` registry. Used to fail
 * closed — before any RPC call — for any asset this milestone doesn't
 * carry live data for (e.g. DAI), rather than falling through to a branch
 * that would substitute another asset's reserve.
 */
export function isLiveBorrowAsset(symbol: string): symbol is AaveV3LiveBorrowAssetSymbol {
  return symbol in AAVE_V3_ETHEREUM_BORROW_ASSETS;
}

/**
 * Fetches one internally-consistent reserve snapshot: every read (reserve
 * config, reserve data, price, and both assets' live ERC20 decimals) is
 * pinned to the same block number, fetched once up front. Decimals are
 * cross-checked against the hardcoded `AAVE_V3_ETHEREUM_ASSETS` registry
 * and fail closed on any mismatch, rather than silently proceeding with a
 * possibly-wrong scale.
 *
 * **`borrowAssetSymbol` (USDT Support milestone)** — looked up against the
 * `AAVE_V3_ETHEREUM_BORROW_ASSETS` registry via `isLiveBorrowAsset` before
 * any RPC call is attempted; an unrecognized symbol (e.g. DAI) fails
 * closed with `AAVE_UNSUPPORTED_BORROW_ASSET` rather than silently
 * fetching USDC's reserve instead.
 */
export async function fetchAaveV3ReserveSnapshot(
  client: AaveV3RpcClient,
  borrowAssetSymbol: string,
): Promise<AaveAdapterResult> {
  if (!isLiveBorrowAsset(borrowAssetSymbol)) {
    return {
      ok: false,
      error: {
        code: 'AAVE_UNSUPPORTED_BORROW_ASSET',
        message: `No live Aave V3 borrow reserve is configured for "${borrowAssetSymbol}".`,
        userMessage: `Live Aave V3 data is not yet available for ${borrowAssetSymbol}.`,
        retryable: false,
      },
    };
  }

  const { collateralAsset, network } = AAVE_V3_ETHEREUM_MARKET;
  const borrowAsset = AAVE_V3_ETHEREUM_BORROW_ASSETS[borrowAssetSymbol];

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
    fetchReserveSnapshot: (borrowAssetSymbol: string) =>
      fetchAaveV3ReserveSnapshot(client, borrowAssetSymbol),
  };
}
