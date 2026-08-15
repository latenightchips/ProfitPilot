import type { Reserve, UserDebt, UserReserveStatus } from './client';

/**
 * Three-layer V4 read model — Stage 3 (V4 Readiness Audit §12), per this
 * stage's own instruction not to force V4 into V3's single
 * `AaveAdapterData` shape (`../types.ts`) if that would lose protocol
 * meaning. V3's shape is built around one reserve-level snapshot with no
 * per-user on-chain read at all (`../v3/index.ts` never calls a user
 * position getter — the app's own portfolio input supplies the user's
 * debt balance). V4 fundamentally requires a per-user, per-reserve read
 * (`drawnShares`/`premiumShares`/`premiumOffsetRay`/the position's
 * effective Risk Premium all live only in `ISpoke.UserPosition`/
 * `PositionStatus`, keyed by an on-chain address), so this module's raw
 * snapshot type is genuinely V4-shaped, not a V3 lookalike.
 */

/**
 * Layer 1 — raw protocol state, exactly as read from the chain (still
 * chain-native integer units: RAY-scaled rates, asset-unit debt amounts
 * scaled by the reserve's own `decimals`, BPS risk premium). No
 * unit-conversion or Engine-facing rounding has happened yet.
 *
 * `blockTimestamp` (Stage 3 hardening review item 4) — the unix-seconds
 * timestamp of `blockNumber` itself, fetched in the SAME `getBlock` call
 * as `blockNumber` (`./client.ts`'s `fetchPinnedBlock`), so the two can
 * never disagree about which block they describe. Every other field in
 * this struct was read pinned to `blockNumber` via each call's own
 * `blockNumber` argument.
 */
export interface RawAaveV4Snapshot {
  blockNumber: bigint;
  blockTimestamp: bigint;
  hub: `0x${string}`;
  spoke: `0x${string}`;
  assetId: bigint;
  reserveId: bigint;
  reserve: Reserve;
  /** `ISpoke.getUserDebt` — live-computed as of `blockNumber`, in the asset's native (undivided) integer units. */
  userDebt: UserDebt;
  /** `IHub.getAssetDrawnRate` — RAY-scaled (1e27 = 100% APR). */
  drawnRateRay: bigint;
  /** `ISpoke.getUserLastRiskPremium` — BPS (10000 = 100%), the position's currently-effective, persisted value. */
  userLastRiskPremiumBps: bigint;
  userReserveStatus: UserReserveStatus;
  /** ERC20 `decimals()`, read live and cross-checked against the hardcoded asset registry (mirrors `../v3/index.ts`'s own cross-check). */
  liveDecimals: number;
}

/**
 * Layer 2 — the exact fields `engine/protocols/aaveV4/projectAaveV4Debt.ts`'s
 * `AaveV4DebtProjectionInput` needs, MINUS `elapsedDays` — that field is a
 * projection horizon supplied by the caller (how far forward to project),
 * not on-chain state, exactly like V3's `elapsedDays` was never read from
 * a contract either. `./mapAaveV4Snapshot.ts` produces this from
 * `RawAaveV4Snapshot` via pure unit conversion only (asset-unit integer ->
 * decimal number, RAY -> fraction, BPS -> fraction) — no accrual math, no
 * rounding beyond what `Number()` division does, mirroring
 * `../v3/mapAaveV3Snapshot.ts`'s own "no financial calculation" discipline
 * (04_BUILD_GUIDE.md "Keep financial calculations out of infrastructure
 * code").
 */
export interface AaveV4EngineDebtInputs {
  drawnDebt: number;
  premiumDebt: number;
  baseDrawnApr: number;
  riskPremium: number;
}

/** Layer 3 — human-readable/display metadata, not consumed by the Engine. */
export interface AaveV4SnapshotDisplay {
  network: string;
  collateralSymbol: string;
  debtSymbol: string;
  hub: `0x${string}`;
  spoke: `0x${string}`;
  reserveId: string;
  /** Stringified — bigint doesn't survive JSON, same convention as `../types.ts`'s `AaveSourceMetadata.blockNumber`. */
  blockNumber: string;
  /** ISO 8601, derived from `RawAaveV4Snapshot.blockTimestamp` (unix seconds -> milliseconds). */
  blockTimestamp: string;
  userAddress: `0x${string}`;
}

export interface AaveV4DebtSnapshot {
  raw: RawAaveV4Snapshot;
  engineInputs: AaveV4EngineDebtInputs;
  display: AaveV4SnapshotDisplay;
}
