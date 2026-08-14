import type { RawPriceCandidate, RawProtocolCandidate } from '@/services';

import type { AaveAdapterData, AaveSourceMetadata } from '../types';
import { basisPointsToDecimal, oraclePriceToUsd, rayToDecimal } from './scale';
import type { RawAaveV3Snapshot } from './types';

export interface MapAaveV3SnapshotConfig {
  network: string;
  collateralSymbol: string;
  borrowSymbol: string;
  /** ISO 8601 instant to stamp the price candidate with — caller-supplied for determinism. */
  now: string;
}

/**
 * Pure mapping from raw, already-fetched contract data to the adapter's
 * public output shape. No RPC calls, no financial calculation — only unit
 * conversion (basis points / ray / oracle-unit -> decimal), matching every
 * other `RawPriceCandidate`/`RawProtocolCandidate` producer in the app.
 */
export function mapAaveV3Snapshot(
  snapshot: RawAaveV3Snapshot,
  config: MapAaveV3SnapshotConfig,
): AaveAdapterData {
  const priceCandidate: RawPriceCandidate = {
    origin: 'provider',
    price: oraclePriceToUsd(
      snapshot.collateralPrice.price,
      snapshot.collateralPrice.baseCurrencyUnit,
    ),
    timestamp: config.now,
  };

  const protocolCandidate: RawProtocolCandidate = {
    origin: 'live',
    timestamp: new Date(snapshot.collateralReserve.lastUpdateTimestamp * 1000).toISOString(),
    parameters: {
      maxLoanToValue: basisPointsToDecimal(snapshot.collateralConfig.ltv),
      liquidationThreshold: basisPointsToDecimal(snapshot.collateralConfig.liquidationThreshold),
      borrowApr: rayToDecimal(snapshot.borrowReserve.variableBorrowRate),
      supplyApr: rayToDecimal(snapshot.collateralReserve.liquidityRate),
    },
  };

  const source: AaveSourceMetadata = {
    protocol: 'aave',
    version: 'v3',
    network: config.network,
    method: 'rpc',
    blockNumber: snapshot.blockNumber.toString(),
  };

  return {
    priceCandidate,
    protocolCandidate,
    collateralSymbol: config.collateralSymbol,
    borrowSymbol: config.borrowSymbol,
    source,
  };
}
