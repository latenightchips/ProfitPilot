import type { AssetPrice, ReserveConfigurationData, ReserveData } from './client';

/** Everything fetched for one reserve snapshot, all pinned to the same block. */
export interface RawAaveV3Snapshot {
  blockNumber: bigint;
  collateralConfig: ReserveConfigurationData;
  collateralReserve: ReserveData;
  collateralPrice: AssetPrice;
  borrowReserve: ReserveData;
  /** ERC20 `decimals()`, read live and cross-checked against the hardcoded asset registry. */
  collateralDecimals: number;
  borrowDecimals: number;
}
