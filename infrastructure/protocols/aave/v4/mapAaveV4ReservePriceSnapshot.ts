import { oraclePriceToUsd } from './scale';
import type { AaveV4ReservePriceSnapshot, RawAaveV4ReservePriceSnapshot } from './types';

export interface MapAaveV4ReservePriceSnapshotConfig {
  network: string;
  collateralSymbol: string;
}

/**
 * Pure mapping from raw, already-fetched V4 reserve-price contract data
 * to the canonical shape — mirrors `./mapAaveV4CollateralRiskSnapshot.ts`'s
 * own "no RPC calls, no accrual/compounding math, only unit conversion"
 * discipline exactly, for the address-independent price-only subset of
 * that same read (see `RawAaveV4ReservePriceSnapshot`'s own header
 * comment in `./types.ts`).
 */
export function mapAaveV4ReservePriceSnapshot(
  snapshot: RawAaveV4ReservePriceSnapshot,
  config: MapAaveV4ReservePriceSnapshotConfig,
): AaveV4ReservePriceSnapshot {
  return {
    raw: snapshot,
    canonical: {
      collateralPriceUsd: oraclePriceToUsd(snapshot.oraclePriceRaw, snapshot.oracleDecimals),
    },
    display: {
      network: config.network,
      collateralSymbol: config.collateralSymbol,
      spoke: snapshot.spoke,
      reserveId: snapshot.collateralReserveId.toString(),
      blockNumber: snapshot.blockNumber.toString(),
      blockTimestamp: new Date(Number(snapshot.blockTimestamp) * 1000).toISOString(),
    },
  };
}
