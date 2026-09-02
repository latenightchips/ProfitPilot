import { rayToDecimal } from './scale';
import type { AaveV4BaseDrawnRateSnapshot, RawAaveV4BaseDrawnRateSnapshot } from './types';

export interface MapAaveV4BaseDrawnRateSnapshotConfig {
  network: string;
  debtSymbol: string;
}

/**
 * Pure mapping from raw, already-fetched V4 base-drawn-rate contract data
 * to the canonical shape — mirrors `./mapAaveV4ReservePriceSnapshot.ts`'s
 * own "no RPC calls, no accrual/compounding math, only unit conversion"
 * discipline exactly, for the address-independent rate-only subset of
 * `mapAaveV4Snapshot.ts`'s own `baseDrawnApr` field (see
 * `RawAaveV4BaseDrawnRateSnapshot`'s own header comment in `./types.ts`).
 */
export function mapAaveV4BaseDrawnRateSnapshot(
  snapshot: RawAaveV4BaseDrawnRateSnapshot,
  config: MapAaveV4BaseDrawnRateSnapshotConfig,
): AaveV4BaseDrawnRateSnapshot {
  return {
    raw: snapshot,
    canonical: {
      baseDrawnApr: rayToDecimal(snapshot.drawnRateRay),
    },
    display: {
      network: config.network,
      debtSymbol: config.debtSymbol,
      hub: snapshot.hub,
      spoke: snapshot.spoke,
      reserveId: snapshot.reserveId.toString(),
      blockNumber: snapshot.blockNumber.toString(),
      blockTimestamp: new Date(Number(snapshot.blockTimestamp) * 1000).toISOString(),
    },
  };
}
