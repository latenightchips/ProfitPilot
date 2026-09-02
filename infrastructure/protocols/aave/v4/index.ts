import {
  AAVE_V4_ETHEREUM_DEBT_ASSETS,
  AAVE_V4_ETHEREUM_HUB_CANDIDATES,
  AAVE_V4_ETHEREUM_MARKET,
  AAVE_V4_ETHEREUM_SPOKE,
  type AaveV4SupportedDebtAssetSymbol,
} from './addresses';
import {
  type AaveV4ProviderError,
  type AaveV4RpcClient,
  createAaveV4RpcClient,
  fetchAssetDrawnRate,
  fetchAssetId,
  fetchDynamicReserveConfig,
  fetchOracleAddress,
  fetchOracleDecimals,
  fetchPinnedBlock,
  fetchReserve,
  fetchReserveId,
  fetchReservePrice,
  fetchTokenDecimals,
  fetchUserDebt,
  fetchUserLastRiskPremium,
  fetchUserPosition,
  fetchUserReserveStatus,
} from './client';
import { mapAaveV4BaseDrawnRateSnapshot } from './mapAaveV4BaseDrawnRateSnapshot';
import { mapAaveV4CollateralRiskSnapshot } from './mapAaveV4CollateralRiskSnapshot';
import { mapAaveV4ReservePriceSnapshot } from './mapAaveV4ReservePriceSnapshot';
import { mapAaveV4Snapshot } from './mapAaveV4Snapshot';
import { oraclePriceToUsd } from './scale';
import type {
  AaveV4BaseDrawnRateSnapshot,
  AaveV4CollateralRiskSnapshot,
  AaveV4DebtSnapshot,
  AaveV4ReservePriceSnapshot,
  RawAaveV4BaseDrawnRateSnapshot,
  RawAaveV4CollateralRiskSnapshot,
  RawAaveV4ReservePriceSnapshot,
  RawAaveV4Snapshot,
} from './types';

export interface AaveV4AdapterError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
}

export type AaveV4SnapshotResult =
  { ok: true; data: AaveV4DebtSnapshot } | { ok: false; error: AaveV4AdapterError };

/**
 * Table-driven guard, mirroring `../v3/index.ts`'s own
 * `isLiveBorrowAsset` — fails closed before any RPC call for any asset
 * this stage doesn't carry live data for (e.g. DAI, not verified for V4).
 */
export function isSupportedV4DebtAsset(symbol: string): symbol is AaveV4SupportedDebtAssetSymbol {
  return symbol in AAVE_V4_ETHEREUM_DEBT_ASSETS;
}

interface ResolvedReserve {
  hub: `0x${string}`;
  assetId: bigint;
  reserveId: bigint;
}

/**
 * Resolves which Hub (of the 4 documented Hubs) actually lists the given
 * underlying asset AND has a reserve for it on `spoke`, by probing each
 * Hub candidate in order and stopping at the first that resolves both
 * `getAssetId` and `getReserveId` successfully — see `./addresses.ts`'s
 * own header comment for why this is resolved at read-time rather than
 * hardcoded: the address book publishes contract addresses, not the
 * Hub<->asset<->Spoke reserve graph, which exists only in on-chain
 * storage. All probe reads are pinned to the same `blockNumber` passed
 * in, preserving single-block consistency even across multiple
 * candidate Hubs.
 *
 * **Stage 3 hardening review (items 1/6): "not found here" vs. genuine
 * failure are no longer conflated.** `Hub.sol`'s `getAssetId` and
 * `Spoke.sol`'s `getReserveId` were verified directly (not just via their
 * interfaces) to revert with the exact custom errors `AssetNotListed`/
 * `ReserveNotListed` — never a sentinel/default value — when an
 * asset/reserve genuinely does not exist on that Hub/Spoke. `./client.ts`'s
 * error classifier decodes reverts against the ABI's own declared custom
 * errors and marks ONLY those two as `notListedErrorName` — this function
 * continues to the next Hub candidate ONLY on that specific, decoded
 * signal. A timeout, a network error, an undecodable response, or any
 * OTHER contract-level revert aborts the probe immediately and surfaces
 * the real `AaveV4ProviderError` to the caller, rather than being
 * silently reinterpreted as "not found on this Hub."
 *
 * Returns `null` (not a thrown error) only when every candidate Hub
 * genuinely does not list the reserve — the caller turns that into a
 * structured `AAVE_V4_RESERVE_NOT_FOUND` error. Returns the first
 * non-"not-listed" error immediately, without exhausting the remaining
 * candidates.
 */
async function resolveV4Reserve(
  client: AaveV4RpcClient,
  spoke: `0x${string}`,
  underlying: `0x${string}`,
  blockNumber: bigint,
): Promise<{ ok: true; data: ResolvedReserve } | { ok: false; error: AaveV4ProviderError | null }> {
  for (const hub of AAVE_V4_ETHEREUM_HUB_CANDIDATES) {
    const assetIdResult = await fetchAssetId(client, hub, underlying, blockNumber);
    if (!assetIdResult.ok) {
      if (assetIdResult.error.notListedErrorName !== undefined) continue;
      return { ok: false, error: assetIdResult.error };
    }

    const reserveIdResult = await fetchReserveId(
      client,
      spoke,
      hub,
      assetIdResult.data,
      blockNumber,
    );
    if (!reserveIdResult.ok) {
      if (reserveIdResult.error.notListedErrorName !== undefined) continue;
      return { ok: false, error: reserveIdResult.error };
    }

    return {
      ok: true,
      data: { hub, assetId: assetIdResult.data, reserveId: reserveIdResult.data },
    };
  }
  return { ok: false, error: null };
}

/**
 * Fetches one internally-consistent V4 debt snapshot for `userAddress`'s
 * position in `debtAssetSymbol`, pinned to a single block — mirrors
 * `../v3/index.ts`'s `fetchAaveV3ReserveSnapshot`'s own "fetch block
 * number once, pass it to every subsequent read" pattern (Stage 3 item 6:
 * "Single-block consistency"). Block TIMESTAMP is fetched in the same
 * call as block number (`fetchPinnedBlock`), so they can never describe
 * different blocks (Stage 3 hardening review item 4).
 *
 * Fails closed (never a partial/placeholder result) on: an unsupported
 * debt asset symbol, no matching reserve found across all 4 candidate
 * Hubs, any genuine RPC/contract failure encountered while probing Hubs
 * (never silently reinterpreted as "not found" — see `resolveV4Reserve`),
 * any individual RPC read failure, a decimals mismatch between the
 * on-chain reserve/ERC20 reads and the hardcoded asset registry, or the
 * user having no borrow position at all for this reserve (`borrowed ===
 * false` — Stage 3 item 13's "missing position state" case: returning
 * `drawnDebt: 0` for a user who never borrowed would be indistinguishable
 * from a user who borrowed and fully repaid, so this is reported as a
 * distinct, explicit error rather than a silent zero).
 *
 * `pinnedBlockNumber` is optional — omitted, this fetches the latest
 * block once and pins every subsequent read to it. Supplying it instead
 * pins every read to that exact historical block — used by
 * `scripts/verifyAaveV4Snapshot.ts` for reproducible manual verification
 * runs.
 */
export async function fetchAaveV4DebtSnapshot(
  client: AaveV4RpcClient,
  debtAssetSymbol: string,
  userAddress: `0x${string}`,
  pinnedBlockNumber?: bigint,
): Promise<AaveV4SnapshotResult> {
  if (!isSupportedV4DebtAsset(debtAssetSymbol)) {
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_UNSUPPORTED_DEBT_ASSET',
        message: `No live Aave V4 debt reserve is configured for "${debtAssetSymbol}".`,
        userMessage: `Live Aave V4 data is not yet available for ${debtAssetSymbol}.`,
        retryable: false,
      },
    };
  }

  const debtAsset = AAVE_V4_ETHEREUM_DEBT_ASSETS[debtAssetSymbol];
  const { collateralAsset, network } = AAVE_V4_ETHEREUM_MARKET;
  const spoke = AAVE_V4_ETHEREUM_SPOKE as `0x${string}`;
  const underlying = debtAsset.address as `0x${string}`;

  const blockResult = await fetchPinnedBlock(client, pinnedBlockNumber);
  if (!blockResult.ok) return { ok: false, error: blockResult.error };
  const { number: blockNumber, timestamp: blockTimestamp } = blockResult.data;

  const resolution = await resolveV4Reserve(client, spoke, underlying, blockNumber);
  if (!resolution.ok) {
    if (resolution.error !== null) return { ok: false, error: resolution.error };
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_RESERVE_NOT_FOUND',
        message: `No Aave V4 reserve for ${debtAsset.symbol} (${underlying}) was found on Spoke ${spoke} across any of the ${AAVE_V4_ETHEREUM_HUB_CANDIDATES.length} known Hubs.`,
        userMessage: `Live Aave V4 data is not yet available for ${debtAssetSymbol}.`,
        retryable: false,
      },
    };
  }
  const { hub, assetId, reserveId } = resolution.data;

  const [
    reserveResult,
    userDebtResult,
    drawnRateResult,
    riskPremiumResult,
    statusResult,
    decimalsResult,
    oracleAddressResult,
  ] = await Promise.all([
    fetchReserve(client, spoke, reserveId, blockNumber),
    fetchUserDebt(client, spoke, reserveId, userAddress, blockNumber),
    fetchAssetDrawnRate(client, hub, assetId, blockNumber),
    fetchUserLastRiskPremium(client, spoke, userAddress, blockNumber),
    fetchUserReserveStatus(client, spoke, reserveId, userAddress, blockNumber),
    fetchTokenDecimals(client, underlying, blockNumber),
    // V4 Readiness Audit §12 P1-D1 — discovered independently from THIS
    // Spoke, never reused from the collateral-risk path's own store/hook
    // (deliberate non-coupling, see this function's own doc comment
    // addition below). Placed in this SAME initial parallel batch (not
    // after the borrowed-position check) so it can never become a NEW
    // failure mode reachable only after `AAVE_V4_NO_BORROW_POSITION` —
    // preserving that error's existing "last possible failure" property,
    // which `scripts/verifyAaveV4Boundary.ts` (P0-3) relies on.
    fetchOracleAddress(client, spoke, blockNumber),
  ]);

  if (!reserveResult.ok) return { ok: false, error: reserveResult.error };
  if (!userDebtResult.ok) return { ok: false, error: userDebtResult.error };
  if (!drawnRateResult.ok) return { ok: false, error: drawnRateResult.error };
  if (!riskPremiumResult.ok) return { ok: false, error: riskPremiumResult.error };
  if (!statusResult.ok) return { ok: false, error: statusResult.error };
  if (!decimalsResult.ok) return { ok: false, error: decimalsResult.error };
  if (!oracleAddressResult.ok) return { ok: false, error: oracleAddressResult.error };
  const oracle = oracleAddressResult.data;

  // Reuses the exact `reserveId` already resolved above for this DEBT
  // reserve — no separate reserve resolution, and never the collateral
  // reserveId (`fetchAaveV4CollateralRiskSnapshot` resolves that
  // independently, in its own, unrelated function call).
  const [oracleDecimalsResult, debtAssetPriceResult] = await Promise.all([
    fetchOracleDecimals(client, oracle, blockNumber),
    fetchReservePrice(client, oracle, reserveId, blockNumber),
  ]);
  if (!oracleDecimalsResult.ok) return { ok: false, error: oracleDecimalsResult.error };
  if (!debtAssetPriceResult.ok) return { ok: false, error: debtAssetPriceResult.error };

  if (reserveResult.data.decimals !== debtAsset.decimals) {
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_DECIMALS_MISMATCH',
        message: `${debtAsset.symbol} on-chain reserve decimals (${reserveResult.data.decimals}) do not match the configured value (${debtAsset.decimals}).`,
        userMessage:
          'Aave V4 asset configuration has changed unexpectedly. Please try again later.',
        retryable: false,
      },
    };
  }
  if (decimalsResult.data !== debtAsset.decimals) {
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_DECIMALS_MISMATCH',
        message: `${debtAsset.symbol} on-chain ERC20 decimals (${decimalsResult.data}) do not match the configured value (${debtAsset.decimals}).`,
        userMessage:
          'Aave V4 asset configuration has changed unexpectedly. Please try again later.',
        retryable: false,
      },
    };
  }

  // V4 Readiness Audit §12 P1-D1 — defense in depth. `AaveOracle.sol`'s
  // own `_getSourcePrice` already reverts (never returns) a non-positive
  // price (verified during P1-A's primary-source trace), so this branch
  // should be unreachable in practice; it exists for the same reason
  // `AAVE_V4_DECIMALS_MISMATCH` does — an on-chain configuration this
  // adapter did not anticipate (e.g. `oracleDecimals` large enough that
  // `10 ** decimals` overflows to `Infinity`, silently normalizing any
  // raw price to `0`) must fail closed, never be silently accepted as a
  // real $0/negative/NaN debt-asset price.
  const debtAssetPriceUsd = oraclePriceToUsd(debtAssetPriceResult.data, oracleDecimalsResult.data);
  if (!Number.isFinite(debtAssetPriceUsd) || debtAssetPriceUsd <= 0) {
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_INVALID_ORACLE_PRICE',
        message: `${debtAsset.symbol} oracle price normalized to a non-finite/non-positive value (raw=${debtAssetPriceResult.data.toString()}, decimals=${oracleDecimalsResult.data}, normalized=${debtAssetPriceUsd}).`,
        userMessage: 'Aave V4 returned an unexpected response. Please try again later.',
        retryable: false,
      },
    };
  }

  if (!statusResult.data.borrowed) {
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_NO_BORROW_POSITION',
        message: `User ${userAddress} has no active ${debtAsset.symbol} borrow position on reserve ${reserveId.toString()} (getUserReserveStatus.borrowed === false).`,
        userMessage: `No live ${debtAssetSymbol} debt position was found for this account.`,
        retryable: false,
      },
    };
  }

  const snapshot: RawAaveV4Snapshot = {
    blockNumber,
    blockTimestamp,
    hub,
    spoke,
    assetId,
    reserveId,
    reserve: reserveResult.data,
    userDebt: userDebtResult.data,
    drawnRateRay: drawnRateResult.data,
    userLastRiskPremiumBps: riskPremiumResult.data,
    userReserveStatus: statusResult.data,
    liveDecimals: decimalsResult.data,
    oracle,
    debtAssetPriceRaw: debtAssetPriceResult.data,
    debtAssetPriceDecimals: oracleDecimalsResult.data,
  };

  const data = mapAaveV4Snapshot(snapshot, {
    network,
    collateralSymbol: collateralAsset.symbol,
    debtSymbol: debtAsset.symbol,
    userAddress,
  });

  // V4 Readiness Audit §12 P1-D1 — attached directly, not routed through
  // `mapAaveV4Snapshot` (which stays exactly as it was): already
  // normalized and validated above, and this stage's own boundary is
  // "establish the authoritative input; nothing consumes it yet" —
  // `data.engineInputs` is type-linked to the Engine's own
  // `AaveV4DebtProjectionRequest` (see `./types.ts`), which has no price
  // field and must not gain one merely to transport this value.
  return { ok: true, data: { ...data, debtAssetPriceUsd } };
}

export type AaveV4CollateralRiskSnapshotResult =
  { ok: true; data: AaveV4CollateralRiskSnapshot } | { ok: false; error: AaveV4AdapterError };

/**
 * Fetches the user's actual, on-chain-bound V4 collateral-risk
 * configuration for the collateral asset — V4 Readiness Audit §12 Stage
 * 23C, closing the Stage 23 finding that Health Factor/liquidation-price/
 * LTV had no source for V4's real risk parameter (they read V3's
 * `protocol.liquidationThreshold` unconditionally). Stage 23B's own
 * authoritative Solidity trace (`aave/aave-v4` commit
 * `2524fe4018a42750300e114f2a8c4355df62a878`, `Spoke.sol`'s
 * `_processUserAccountData`) established `collateralFactor` as V4's sole
 * borrow-capacity/liquidation-eligibility parameter, read at the user's
 * own BOUND dynamic-config snapshot — never the reserve's current one.
 *
 * **Deliberately independent of `fetchAaveV4DebtSnapshot` above, not
 * folded into it, despite both being "one V4 read cycle."** That
 * function resolves a reserve for the DEBT asset; this one resolves a
 * reserve for the COLLATERAL asset (`AAVE_V4_ETHEREUM_MARKET.collateralAsset`,
 * WBTC) — a genuinely different reserve, potentially on a different Hub.
 * Coupling the two into one all-or-nothing fetch would mean an existing,
 * already-relied-on debt sync could start failing for a reason that has
 * nothing to do with debt (e.g. this reserve-resolution probe failing) —
 * `v4DebtState` staying correctly populated must not become contingent on
 * collateral-risk data that no calculation consumes yet (Stage 23C's own
 * scope boundary: "leave consumers unchanged"). Each fetch pins its own
 * block independently — Stage 23C does not require the two to share a
 * block, only that each individually follows the pinned-block/
 * read-or-classify/fail-closed convention already established.
 *
 * **Two reads, in this exact order, never substituting one for the
 * other's job:**
 * 1. `getUserPosition(collateralReserveId, user)` → the user's OWN bound
 *    `dynamicConfigKey`. If this fails, the whole result fails closed —
 *    there is no fallback to the reserve's current
 *    `Reserve.dynamicConfigKey` (`fetchReserve`'s own field of the same
 *    name is a DIFFERENT value with a different meaning; see
 *    `./abi.ts`'s own header comment).
 * 2. `getDynamicReserveConfig(collateralReserveId, thatExactKey)` → the
 *    real `collateralFactor` bound to the user's position. Never called
 *    with any key other than the one read in step 1.
 *
 * **Oracle price boundary (V4 Readiness Audit §12 P1-B).** Alongside the
 * two reads above, this also resolves the collateral asset's V4-native
 * oracle price — verified against primary source
 * (`aave/aave-v4@2524fe4018a42750300e114f2a8c4355df62a878`) to require
 * `ISpoke.ORACLE()` (this Spoke's own bound oracle — oracles are
 * Spoke-specific in V4, never a single pool-wide contract the way V3's
 * is; see `./abi.ts`'s `spokeOracleAbi` header comment) →
 * `IPriceOracle.getReservePrice(collateralReserveId)`, using the exact
 * same `reserveId` already resolved above, no separate resolution — plus
 * `IPriceOracle.decimals()`, read live rather than hardcoded. This is an
 * infrastructure boundary only: `AaveV4CollateralRiskCanonical.collateralPriceUsd`
 * is populated, but nothing downstream consumes it yet (no change to
 * `portfolio.market.btcPriceUsd`, any live-sync hook, or any Engine
 * formula).
 *
 * Any failure at any step — reserve resolution, either risk-config read,
 * or any of the three oracle reads — produces `ok: false`; there is no
 * partial/placeholder result, no fallback to V3's oracle, and no
 * fabricated price (never silently 0, $1, or a cached unrelated value).
 */
export async function fetchAaveV4CollateralRiskSnapshot(
  client: AaveV4RpcClient,
  userAddress: `0x${string}`,
  pinnedBlockNumber?: bigint,
): Promise<AaveV4CollateralRiskSnapshotResult> {
  const { collateralAsset, network } = AAVE_V4_ETHEREUM_MARKET;
  const spoke = AAVE_V4_ETHEREUM_SPOKE as `0x${string}`;
  const underlying = collateralAsset.address as `0x${string}`;

  const blockResult = await fetchPinnedBlock(client, pinnedBlockNumber);
  if (!blockResult.ok) return { ok: false, error: blockResult.error };
  const { number: blockNumber, timestamp: blockTimestamp } = blockResult.data;

  const resolution = await resolveV4Reserve(client, spoke, underlying, blockNumber);
  if (!resolution.ok) {
    if (resolution.error !== null) return { ok: false, error: resolution.error };
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_RESERVE_NOT_FOUND',
        message: `No Aave V4 reserve for ${collateralAsset.symbol} (${underlying}) was found on Spoke ${spoke} across any of the ${AAVE_V4_ETHEREUM_HUB_CANDIDATES.length} known Hubs.`,
        userMessage: `Live Aave V4 collateral-risk data is not yet available for ${collateralAsset.symbol}.`,
        retryable: false,
      },
    };
  }
  const { reserveId } = resolution.data;

  const [userPositionResult, oracleAddressResult] = await Promise.all([
    fetchUserPosition(client, spoke, reserveId, userAddress, blockNumber),
    fetchOracleAddress(client, spoke, blockNumber),
  ]);
  if (!userPositionResult.ok) return { ok: false, error: userPositionResult.error };
  if (!oracleAddressResult.ok) return { ok: false, error: oracleAddressResult.error };
  const oracle = oracleAddressResult.data;

  const [dynamicConfigResult, oracleDecimalsResult, reservePriceResult] = await Promise.all([
    fetchDynamicReserveConfig(
      client,
      spoke,
      reserveId,
      userPositionResult.data.dynamicConfigKey,
      blockNumber,
    ),
    fetchOracleDecimals(client, oracle, blockNumber),
    // Reuses `reserveId` exactly as resolved above — no separate reserve
    // resolution for the price read.
    fetchReservePrice(client, oracle, reserveId, blockNumber),
  ]);
  if (!dynamicConfigResult.ok) return { ok: false, error: dynamicConfigResult.error };
  if (!oracleDecimalsResult.ok) return { ok: false, error: oracleDecimalsResult.error };
  if (!reservePriceResult.ok) return { ok: false, error: reservePriceResult.error };

  const snapshot: RawAaveV4CollateralRiskSnapshot = {
    blockNumber,
    blockTimestamp,
    spoke,
    collateralReserveId: reserveId,
    userDynamicConfigKey: userPositionResult.data.dynamicConfigKey,
    dynamicReserveConfig: dynamicConfigResult.data,
    oracle,
    oraclePriceRaw: reservePriceResult.data,
    oracleDecimals: oracleDecimalsResult.data,
  };

  const data = mapAaveV4CollateralRiskSnapshot(snapshot, {
    network,
    collateralSymbol: collateralAsset.symbol,
    userAddress,
  });

  return { ok: true, data };
}

export type AaveV4ReservePriceSnapshotResult =
  { ok: true; data: AaveV4ReservePriceSnapshot } | { ok: false; error: AaveV4AdapterError };

/**
 * Fetches the collateral asset's live V4 reserve price — the
 * wallet-address-independent subset of `fetchAaveV4CollateralRiskSnapshot`
 * above. Closes the "V4 new-portfolio creation requires an on-chain
 * address before BTC price can become live" finding: `ISpoke.ORACLE()`
 * → `IPriceOracle.getReservePrice(reserveId)`/`.decimals()` never
 * depended on a user address to begin with — only `collateralFactor`
 * (via `getUserPosition`/`getDynamicReserveConfig`, deliberately absent
 * from this function) does. Reusing `resolveV4Reserve`'s own probe
 * across the same `AAVE_V4_ETHEREUM_HUB_CANDIDATES`, this fetches
 * exactly the reserve/oracle reads `fetchAaveV4CollateralRiskSnapshot`
 * already performs for its own price field, minus the two user-position
 * reads — never a second, independently-maintained reserve-resolution
 * or oracle-read implementation.
 *
 * **V4's own oracle, never V3's — no fallback.** Same discipline as
 * `fetchAaveV4CollateralRiskSnapshot`'s own doc comment: any failure at
 * any step fails closed (`ok: false`), never substitutes V3's
 * `AaveOracle` price or a fabricated value.
 *
 * **Deliberately does not read `getUserPosition`/`getDynamicReserveConfig`
 * at all** — not just "ignores the result." Wallet-address-dependent
 * V4 state (`collateralFactor`, debt) stays exclusively the job of
 * `fetchAaveV4CollateralRiskSnapshot`/`fetchAaveV4DebtSnapshot`; this
 * function has no `userAddress` parameter to accidentally wire one up
 * to, by construction.
 */
export async function fetchAaveV4ReservePrice(
  client: AaveV4RpcClient,
  pinnedBlockNumber?: bigint,
): Promise<AaveV4ReservePriceSnapshotResult> {
  const { collateralAsset, network } = AAVE_V4_ETHEREUM_MARKET;
  const spoke = AAVE_V4_ETHEREUM_SPOKE as `0x${string}`;
  const underlying = collateralAsset.address as `0x${string}`;

  const blockResult = await fetchPinnedBlock(client, pinnedBlockNumber);
  if (!blockResult.ok) return { ok: false, error: blockResult.error };
  const { number: blockNumber, timestamp: blockTimestamp } = blockResult.data;

  const resolution = await resolveV4Reserve(client, spoke, underlying, blockNumber);
  if (!resolution.ok) {
    if (resolution.error !== null) return { ok: false, error: resolution.error };
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_RESERVE_NOT_FOUND',
        message: `No Aave V4 reserve for ${collateralAsset.symbol} (${underlying}) was found on Spoke ${spoke} across any of the ${AAVE_V4_ETHEREUM_HUB_CANDIDATES.length} known Hubs.`,
        userMessage: `Live Aave V4 price data is not yet available for ${collateralAsset.symbol}.`,
        retryable: false,
      },
    };
  }
  const { reserveId } = resolution.data;

  const oracleAddressResult = await fetchOracleAddress(client, spoke, blockNumber);
  if (!oracleAddressResult.ok) return { ok: false, error: oracleAddressResult.error };
  const oracle = oracleAddressResult.data;

  const [oracleDecimalsResult, reservePriceResult] = await Promise.all([
    fetchOracleDecimals(client, oracle, blockNumber),
    // Reuses `reserveId` exactly as resolved above — no separate reserve
    // resolution for the price read.
    fetchReservePrice(client, oracle, reserveId, blockNumber),
  ]);
  if (!oracleDecimalsResult.ok) return { ok: false, error: oracleDecimalsResult.error };
  if (!reservePriceResult.ok) return { ok: false, error: reservePriceResult.error };

  const snapshot: RawAaveV4ReservePriceSnapshot = {
    blockNumber,
    blockTimestamp,
    spoke,
    collateralReserveId: reserveId,
    oracle,
    oraclePriceRaw: reservePriceResult.data,
    oracleDecimals: oracleDecimalsResult.data,
  };

  const data = mapAaveV4ReservePriceSnapshot(snapshot, {
    network,
    collateralSymbol: collateralAsset.symbol,
  });

  return { ok: true, data };
}

export type AaveV4BaseDrawnRateSnapshotResult =
  { ok: true; data: AaveV4BaseDrawnRateSnapshot } | { ok: false; error: AaveV4AdapterError };

/**
 * Fetches the debt asset's live V4 base drawn rate — the
 * wallet-address-independent subset of `fetchAaveV4DebtSnapshot` above
 * (V4 Manual-Data / Provenance Audit). `IHub.getAssetDrawnRate(assetId)`
 * never depended on a user address to begin with — only `getUserDebt`
 * (drawn/premium debt) and `getUserLastRiskPremium` (risk premium),
 * deliberately absent from this function, do. Reuses `resolveV4Reserve`
 * and `client.ts`'s own `fetchAssetDrawnRate` exactly as
 * `fetchAaveV4DebtSnapshot` already does — never a second,
 * independently-maintained reserve-resolution or rate-read
 * implementation, mirroring `fetchAaveV4ReservePrice`'s own "reuse, not
 * re-derive" discipline for the collateral price.
 *
 * **No fallback to V3.** Same discipline as every other V4 fetch in this
 * module: any failure at any step fails closed (`ok: false`), never
 * substitutes a V3 rate or a fabricated value.
 *
 * **Deliberately does not read `getUserDebt`/`getUserLastRiskPremium` at
 * all** — not just "ignores the result." Wallet-address-dependent V4
 * debt state stays exclusively the job of `fetchAaveV4DebtSnapshot`; this
 * function has no `userAddress` parameter to accidentally wire one up
 * to, by construction.
 */
export async function fetchAaveV4BaseDrawnRate(
  client: AaveV4RpcClient,
  debtAssetSymbol: string,
  pinnedBlockNumber?: bigint,
): Promise<AaveV4BaseDrawnRateSnapshotResult> {
  if (!isSupportedV4DebtAsset(debtAssetSymbol)) {
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_UNSUPPORTED_DEBT_ASSET',
        message: `No live Aave V4 debt reserve is configured for "${debtAssetSymbol}".`,
        userMessage: `Live Aave V4 data is not yet available for ${debtAssetSymbol}.`,
        retryable: false,
      },
    };
  }

  const debtAsset = AAVE_V4_ETHEREUM_DEBT_ASSETS[debtAssetSymbol];
  const { network } = AAVE_V4_ETHEREUM_MARKET;
  const spoke = AAVE_V4_ETHEREUM_SPOKE as `0x${string}`;
  const underlying = debtAsset.address as `0x${string}`;

  const blockResult = await fetchPinnedBlock(client, pinnedBlockNumber);
  if (!blockResult.ok) return { ok: false, error: blockResult.error };
  const { number: blockNumber, timestamp: blockTimestamp } = blockResult.data;

  const resolution = await resolveV4Reserve(client, spoke, underlying, blockNumber);
  if (!resolution.ok) {
    if (resolution.error !== null) return { ok: false, error: resolution.error };
    return {
      ok: false,
      error: {
        code: 'AAVE_V4_RESERVE_NOT_FOUND',
        message: `No Aave V4 reserve for ${debtAsset.symbol} (${underlying}) was found on Spoke ${spoke} across any of the ${AAVE_V4_ETHEREUM_HUB_CANDIDATES.length} known Hubs.`,
        userMessage: `Live Aave V4 data is not yet available for ${debtAssetSymbol}.`,
        retryable: false,
      },
    };
  }
  const { hub, assetId, reserveId } = resolution.data;

  const drawnRateResult = await fetchAssetDrawnRate(client, hub, assetId, blockNumber);
  if (!drawnRateResult.ok) return { ok: false, error: drawnRateResult.error };

  const snapshot: RawAaveV4BaseDrawnRateSnapshot = {
    blockNumber,
    blockTimestamp,
    hub,
    spoke,
    reserveId,
    drawnRateRay: drawnRateResult.data,
  };

  const data = mapAaveV4BaseDrawnRateSnapshot(snapshot, {
    network,
    debtSymbol: debtAsset.symbol,
  });

  return { ok: true, data };
}

export interface CreateAaveV4AdapterParams {
  rpcUrl: string;
}

/**
 * Standalone V4 read adapter — deliberately NOT registered in
 * `../index.ts`'s `getAaveAdapter` dispatcher yet (Stage 3 item 16: "No
 * app integration yet"). V4's return shape (`AaveV4DebtSnapshot`) is
 * genuinely different from the `AaveAdapter`/`AaveAdapterResult`
 * interface every V3 caller already depends on (see `./types.ts`'s own
 * header comment) — wiring version dispatch through the shared
 * `AaveAdapter` interface belongs to a future integration stage, once a
 * caller actually needs to choose between the two shapes.
 */
export function createAaveV4Adapter(params: CreateAaveV4AdapterParams) {
  const client = createAaveV4RpcClient(params.rpcUrl);
  return {
    version: 'v4' as const,
    fetchDebtSnapshot: (debtAssetSymbol: string, userAddress: `0x${string}`) =>
      fetchAaveV4DebtSnapshot(client, debtAssetSymbol, userAddress),
  };
}
