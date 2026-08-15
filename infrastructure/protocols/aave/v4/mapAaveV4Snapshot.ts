import { assetUnitsToDecimal, basisPointsToDecimal, rayToDecimal } from './scale';
import type { AaveV4DebtSnapshot, RawAaveV4Snapshot } from './types';

export interface MapAaveV4SnapshotConfig {
  network: string;
  collateralSymbol: string;
  debtSymbol: string;
  userAddress: `0x${string}`;
}

/**
 * Pure mapping from raw, already-fetched V4 contract data to
 * `AaveV4EngineDebtInputs` — the exact fields
 * `engine/protocols/aaveV4/projectAaveV4Debt.ts`'s `AaveV4DebtProjectionInput`
 * needs (minus `elapsedDays`, a caller-supplied projection horizon, not
 * on-chain state — see `./types.ts`'s own doc comment). No RPC calls, no
 * accrual/compounding math — only unit conversion (asset-unit integer /
 * RAY / BPS -> decimal number), matching `../v3/mapAaveV3Snapshot.ts`'s
 * own "no financial calculation" discipline.
 *
 * Every value mapped here was itself already live-computed on-chain by
 * `ISpoke.getUserDebt` (calls through to `UserPositionUtils.getDebt`,
 * which uses `IHubBase.getAssetDrawnIndex`'s CURRENT projected index —
 * confirmed by reading `Spoke.sol`'s own implementation, both during
 * Stage 3's initial source trace and again during the Stage 3 hardening
 * review) — this mapper does not re-derive drawn/premium debt from
 * `drawnShares`/`premiumShares`/`premiumOffsetRay` itself; it only
 * rescales the Spoke's own already-correct output.
 */
export function mapAaveV4Snapshot(
  snapshot: RawAaveV4Snapshot,
  config: MapAaveV4SnapshotConfig,
): AaveV4DebtSnapshot {
  const decimals = snapshot.liveDecimals;

  return {
    raw: snapshot,
    engineInputs: {
      drawnDebt: assetUnitsToDecimal(snapshot.userDebt.drawnDebt, decimals),
      premiumDebt: assetUnitsToDecimal(snapshot.userDebt.premiumDebt, decimals),
      baseDrawnApr: rayToDecimal(snapshot.drawnRateRay),
      riskPremium: basisPointsToDecimal(snapshot.userLastRiskPremiumBps),
    },
    display: {
      network: config.network,
      collateralSymbol: config.collateralSymbol,
      debtSymbol: config.debtSymbol,
      hub: snapshot.hub,
      spoke: snapshot.spoke,
      reserveId: snapshot.reserveId.toString(),
      blockNumber: snapshot.blockNumber.toString(),
      blockTimestamp: new Date(Number(snapshot.blockTimestamp) * 1000).toISOString(),
      userAddress: config.userAddress,
    },
  };
}
