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
  fetchPinnedBlock,
  fetchReserve,
  fetchReserveId,
  fetchTokenDecimals,
  fetchUserDebt,
  fetchUserLastRiskPremium,
  fetchUserReserveStatus,
} from './client';
import { mapAaveV4Snapshot } from './mapAaveV4Snapshot';
import type { AaveV4DebtSnapshot, RawAaveV4Snapshot } from './types';

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
  ] = await Promise.all([
    fetchReserve(client, spoke, reserveId, blockNumber),
    fetchUserDebt(client, spoke, reserveId, userAddress, blockNumber),
    fetchAssetDrawnRate(client, hub, assetId, blockNumber),
    fetchUserLastRiskPremium(client, spoke, userAddress, blockNumber),
    fetchUserReserveStatus(client, spoke, reserveId, userAddress, blockNumber),
    fetchTokenDecimals(client, underlying, blockNumber),
  ]);

  if (!reserveResult.ok) return { ok: false, error: reserveResult.error };
  if (!userDebtResult.ok) return { ok: false, error: userDebtResult.error };
  if (!drawnRateResult.ok) return { ok: false, error: drawnRateResult.error };
  if (!riskPremiumResult.ok) return { ok: false, error: riskPremiumResult.error };
  if (!statusResult.ok) return { ok: false, error: statusResult.error };
  if (!decimalsResult.ok) return { ok: false, error: decimalsResult.error };

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
  };

  const data = mapAaveV4Snapshot(snapshot, {
    network,
    collateralSymbol: collateralAsset.symbol,
    debtSymbol: debtAsset.symbol,
    userAddress,
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
