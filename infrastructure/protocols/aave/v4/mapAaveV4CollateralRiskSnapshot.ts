import { bpsNumberToDecimal } from './scale';
import type { AaveV4CollateralRiskSnapshot, RawAaveV4CollateralRiskSnapshot } from './types';

export interface MapAaveV4CollateralRiskSnapshotConfig {
  network: string;
  collateralSymbol: string;
  userAddress: `0x${string}`;
}

/**
 * Pure mapping from raw, already-fetched V4 collateral-risk contract data
 * to the canonical shape — V4 Readiness Audit §12 Stage 23C, mirroring
 * `./mapAaveV4Snapshot.ts`'s own "no RPC calls, no accrual/compounding
 * math, only unit conversion" discipline exactly.
 *
 * **`dynamicConfigKey` is carried through unchanged, not reprojected or
 * discarded** — it is `collateralFactor`'s own provenance (which
 * dynamic-config version the user's position was bound to when this was
 * read), not a value this mapper derives.
 */
export function mapAaveV4CollateralRiskSnapshot(
  snapshot: RawAaveV4CollateralRiskSnapshot,
  config: MapAaveV4CollateralRiskSnapshotConfig,
): AaveV4CollateralRiskSnapshot {
  return {
    raw: snapshot,
    canonical: {
      collateralFactor: bpsNumberToDecimal(snapshot.dynamicReserveConfig.collateralFactor),
      dynamicConfigKey: snapshot.userDynamicConfigKey,
    },
    display: {
      network: config.network,
      collateralSymbol: config.collateralSymbol,
      spoke: snapshot.spoke,
      reserveId: snapshot.collateralReserveId.toString(),
      blockNumber: snapshot.blockNumber.toString(),
      blockTimestamp: new Date(Number(snapshot.blockTimestamp) * 1000).toISOString(),
      userAddress: config.userAddress,
    },
  };
}
