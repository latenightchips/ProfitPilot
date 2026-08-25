import type { AaveV4DebtProjectionRequest } from '@/engine';

import type { DynamicReserveConfig, Reserve, UserDebt, UserReserveStatus } from './client';

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
  /**
   * `ISpoke.ORACLE()` — V4 Readiness Audit §12 P1-D1, the debt equivalent
   * of P1-B's collateral-risk `oracle` field. Discovered independently
   * from THIS Spoke on every fetch — never reused from
   * `fetchAaveV4CollateralRiskSnapshot`'s own already-fetched oracle
   * (deliberate non-coupling between the two independent fetches; see
   * `./index.ts`'s own header comment).
   */
  oracle: `0x${string}`;
  /** `IPriceOracle.getReservePrice(reserveId)` — the SAME `reserveId` above (the DEBT reserve), no separate resolution. Raw, `debtAssetPriceDecimals`-precision integer, not yet normalized. */
  debtAssetPriceRaw: bigint;
  /** `IPriceOracle.decimals()` — read live from `oracle`, never hardcoded. */
  debtAssetPriceDecimals: number;
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
 *
 * Stage 3 completion audit (contract-drift finding, Medium): this used to
 * be an independently-declared interface with the same 4 fields
 * duplicated by hand — structurally compatible with the Engine's own
 * `AaveV4DebtProjectionRequest` (`engine/protocols/types.ts`) but not
 * type-linked, so a future Engine field change would silently drift
 * rather than fail to compile here. Derived via `Omit` from
 * `AaveV4DebtProjectionRequest` instead — a type-only import from the
 * Engine's already-public `@/engine` barrel (`AaveV4DebtProjectionRequest`
 * is exported there today), so this introduces no runtime dependency and
 * preserves the Engine's own "zero external dependencies" rule (only
 * Infrastructure depends on Engine types, never the reverse — the same
 * direction the Service layer already uses). `protocolVersion` is also
 * omitted: that discriminant belongs to the dispatcher-level request
 * shape, not to this adapter's per-field engine-input layer.
 */
export type AaveV4EngineDebtInputs = Omit<
  AaveV4DebtProjectionRequest,
  'protocolVersion' | 'elapsedDays'
>;

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
  /**
   * V4 Readiness Audit §12 P1-D1 — the debt asset's V4-authoritative
   * oracle price, a plain USD decimal (e.g. `0.9998`), normalized from
   * `raw.debtAssetPriceRaw`/`raw.debtAssetPriceDecimals`. Deliberately a
   * top-level sibling field, not inside `engineInputs` — that shape is
   * type-linked to the Engine's own `AaveV4DebtProjectionRequest` (see
   * this file's own comment above `AaveV4EngineDebtInputs`), which has no
   * price field and is not being widened by this stage. At P1-D1 this was
   * infrastructure-boundary only; as of **P1-D3** it flows through
   * `stores/aaveV4LiveDataStore.ts` and `AaveV4DebtState`
   * (`services/portfolio/models.ts`) to `resolveCanonicalDebtBalance`
   * (`services/portfolio/mapping.ts`), the one place it is actually
   * consumed, via the canonical `calculateDebtAssetValue` Engine formula.
   */
  debtAssetPriceUsd: number;
}

/**
 * Collateral-risk read model — V4 Readiness Audit §12 Stage 23C, a
 * genuinely separate on-chain concern from `RawAaveV4Snapshot` above:
 * that snapshot resolves a reserve for the DEBT asset; this one resolves
 * a reserve for the COLLATERAL asset (`addresses.ts`'s own
 * `AAVE_V4_ETHEREUM_MARKET.collateralAsset`, WBTC) — the two can
 * genuinely be different reserves (potentially even on different Hubs;
 * `./index.ts`'s `resolveV4Reserve` is reused unchanged for both,
 * probing independently). Deliberately its own standalone fetch, not
 * folded into `fetchAaveV4DebtSnapshot` — see that function's own doc
 * comment in `./index.ts` for why coupling the two would risk an
 * existing, already-relied-on debt sync failing for a reason that has
 * nothing to do with debt.
 *
 * **`userDynamicConfigKey` is preserved through every layer, not
 * discarded after use** — it is the provenance of `collateralFactor`:
 * proof of exactly which dynamic-config version the value corresponds
 * to (the user's own bound snapshot, `ISpoke.UserPosition.dynamicConfigKey`
 * — see `./abi.ts`'s own header comment for why this is not necessarily
 * the reserve's current config).
 */
export interface RawAaveV4CollateralRiskSnapshot {
  blockNumber: bigint;
  blockTimestamp: bigint;
  spoke: `0x${string}`;
  collateralReserveId: bigint;
  /** `ISpoke.getUserPosition(collateralReserveId, user).dynamicConfigKey` — the user's own bound snapshot, never substituted with the reserve's current key. */
  userDynamicConfigKey: number;
  /** `ISpoke.getDynamicReserveConfig(collateralReserveId, userDynamicConfigKey)` — fetched using the exact key above, never the reserve's current one. */
  dynamicReserveConfig: DynamicReserveConfig;
  /**
   * `ISpoke.ORACLE()` — V4 Readiness Audit §12 P1-B. This Spoke's own
   * bound oracle, discovered fresh on every fetch, never hardcoded or
   * assumed shared with another Spoke/V3.
   */
  oracle: `0x${string}`;
  /** `IPriceOracle.getReservePrice(collateralReserveId)` — the SAME `collateralReserveId` above, no separate resolution. Raw, `oracleDecimals`-precision integer, not yet normalized. */
  oraclePriceRaw: bigint;
  /** `IPriceOracle.decimals()` — read live from `oracle`, never hardcoded (the reference implementation currently uses 8, but this is not assumed). */
  oracleDecimals: number;
}

/**
 * Layer 2 — the canonical, decimal-scaled shape. Structurally identical
 * to (but independently declared from, never imported from)
 * `services/portfolio/models.ts`'s `AaveV4CollateralRiskConfig` — the
 * same "duplicate the shape across layers, never cross-import" rule
 * `AaveV4EngineDebtInputs`/`AaveV4DebtState` already establish above.
 */
export interface AaveV4CollateralRiskCanonical {
  /** Decimal fraction (e.g. `0.75` for 75%), scaled from `DynamicReserveConfig.collateralFactor` (BPS) via `./scale.ts`'s `bpsNumberToDecimal`. */
  collateralFactor: number;
  /** The exact dynamic-config key `collateralFactor` was read at — carried through unchanged from `RawAaveV4CollateralRiskSnapshot.userDynamicConfigKey`. */
  dynamicConfigKey: number;
  /**
   * V4 Readiness Audit §12 P1-B — the collateral asset's V4-authoritative
   * oracle price, a plain USD decimal (e.g. `69000`), scaled from
   * `RawAaveV4CollateralRiskSnapshot.oraclePriceRaw` via
   * `./scale.ts`'s `oraclePriceToUsd`, using that same raw snapshot's own
   * `oracleDecimals` — never a hardcoded precision. This is an
   * infrastructure-boundary field only: no consumer (Store, Engine,
   * `market.btcPriceUsd`) reads it yet.
   */
  collateralPriceUsd: number;
}

/** Layer 3 — human-readable/display metadata, not consumed by any calculation. */
export interface AaveV4CollateralRiskDisplay {
  network: string;
  collateralSymbol: string;
  spoke: `0x${string}`;
  reserveId: string;
  /** Stringified — bigint doesn't survive JSON, same convention as `AaveV4SnapshotDisplay.blockNumber`. */
  blockNumber: string;
  /** ISO 8601, derived from `RawAaveV4CollateralRiskSnapshot.blockTimestamp`. */
  blockTimestamp: string;
  userAddress: `0x${string}`;
}

export interface AaveV4CollateralRiskSnapshot {
  raw: RawAaveV4CollateralRiskSnapshot;
  canonical: AaveV4CollateralRiskCanonical;
  display: AaveV4CollateralRiskDisplay;
}
