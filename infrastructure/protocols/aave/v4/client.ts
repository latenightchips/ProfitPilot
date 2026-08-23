import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  http,
  HttpRequestError,
  type PublicClient,
  TimeoutError,
} from 'viem';
import { mainnet } from 'viem/chains';

import {
  erc20Abi,
  hubGetAssetDrawnRateAbi,
  hubGetAssetIdAbi,
  priceOracleAbi,
  spokeGetDynamicReserveConfigAbi,
  spokeGetReserveAbi,
  spokeGetReserveIdAbi,
  spokeGetUserDebtAbi,
  spokeGetUserLastRiskPremiumAbi,
  spokeGetUserPositionAbi,
  spokeGetUserReserveStatusAbi,
  spokeOracleAbi,
} from './abi';

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

/**
 * Only the read surface this adapter needs — same "keeps the injectable
 * client mockable in tests" rationale as `../v3/client.ts`. `getBlock`
 * (not `getBlockNumber`) is used so block number and block timestamp
 * always come from the SAME response object, trivially satisfying
 * "timestamp and state must correspond to the same pinned block" (Stage 3
 * hardening review item 4) — there is no window in which the two could
 * disagree, unlike two separate calls would risk.
 */
export type AaveV4RpcClient = Pick<PublicClient, 'readContract' | 'getBlock'>;

export function createAaveV4RpcClient(rpcUrl: string): AaveV4RpcClient {
  return createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { timeout: TIMEOUT_MS, retryCount: MAX_RETRIES, retryDelay: 500 }),
  });
}

/**
 * The two custom errors (Stage 3 hardening review items 1/6) that
 * `resolveV4Reserve` (`./index.ts`) is allowed to treat as "not present
 * on this Hub/Spoke" during discovery — verified directly against
 * `Hub.sol`'s `getAssetId` and `Spoke.sol`'s `getReserveId`
 * implementations (see `./abi.ts`'s header comment). Any other failure
 * (a different revert, a timeout, a network error, an undecodable
 * response) must NOT be treated as "not found."
 */
const RESERVE_DISCOVERY_NOT_LISTED_ERRORS = ['AssetNotListed', 'ReserveNotListed'] as const;
type NotListedErrorName = (typeof RESERVE_DISCOVERY_NOT_LISTED_ERRORS)[number];

export interface AaveV4ProviderError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  /**
   * Set ONLY when the revert was decoded (via viem, against the ABI's own
   * declared custom errors) as specifically `AssetNotListed` or
   * `ReserveNotListed` — the sole condition under which
   * `resolveV4Reserve` may continue probing the next Hub candidate rather
   * than aborting with this error.
   */
  notListedErrorName?: NotListedErrorName;
}

export type AaveV4RpcResult<T> = { ok: true; data: T } | { ok: false; error: AaveV4ProviderError };

function providerError(
  code: string,
  message: string,
  userMessage: string,
  retryable: boolean,
  notListedErrorName?: NotListedErrorName,
): AaveV4ProviderError {
  return { code, message, userMessage, retryable, notListedErrorName };
}

function isNotListedErrorName(name: string | undefined): name is NotListedErrorName {
  return (
    name !== undefined && (RESERVE_DISCOVERY_NOT_LISTED_ERRORS as readonly string[]).includes(name)
  );
}

/**
 * Classifies an RPC failure by walking viem's own cause chain — identical
 * approach to `../v3/client.ts`'s `classifyError` (see that file's own
 * comment for why the outer error type alone is insufficient).
 *
 * **Discovery-safe vs. everything else (Stage 3 hardening review items
 * 1/6)**: a decoded `ContractFunctionRevertedError` whose `data.errorName`
 * is exactly `AssetNotListed`/`ReserveNotListed` gets its own
 * `AAVE_V4_RESERVE_NOT_LISTED_HERE` code and `notListedErrorName` set —
 * `resolveV4Reserve` checks that field specifically before continuing to
 * the next Hub. A timeout, a network error, an undecodable/unknown
 * revert, or any OTHER named revert all fall through to their own
 * distinct, non-"not-listed" codes and stop the probe immediately instead
 * of being silently swallowed as "not found."
 */
function classifyError(error: unknown): AaveV4ProviderError {
  if (error instanceof BaseError) {
    const timeoutCause = error.walk((cause) => cause instanceof TimeoutError);
    if (timeoutCause) {
      return providerError(
        'AAVE_V4_RPC_TIMEOUT',
        `RPC request timed out: ${error.shortMessage}`,
        'The Aave V4 data request timed out. Please try again.',
        true,
      );
    }

    const httpCause = error.walk((cause) => cause instanceof HttpRequestError);
    if (httpCause instanceof HttpRequestError) {
      return providerError(
        'AAVE_V4_RPC_NETWORK_ERROR',
        `RPC network error: ${httpCause.shortMessage}`,
        'Could not reach the Ethereum RPC endpoint. Please try again.',
        true,
      );
    }

    const revertCause = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
    if (revertCause instanceof ContractFunctionRevertedError) {
      const errorName = revertCause.data?.errorName;
      if (isNotListedErrorName(errorName)) {
        return providerError(
          'AAVE_V4_RESERVE_NOT_LISTED_HERE',
          `${errorName}: not present on this Hub/Spoke.`,
          'Live Aave V4 data is not available for this combination.',
          false,
          errorName,
        );
      }
      return providerError(
        'AAVE_V4_RPC_CONTRACT_ERROR',
        `Contract reverted: ${errorName ?? revertCause.shortMessage}`,
        'Aave V4 returned an unexpected response. Please try again later.',
        false,
      );
    }

    return providerError(
      'AAVE_V4_RPC_CONTRACT_ERROR',
      `Contract call failed: ${error.shortMessage}`,
      'Aave V4 returned an unexpected response. Please try again later.',
      false,
    );
  }

  return providerError(
    'AAVE_V4_RPC_UNKNOWN_ERROR',
    error instanceof Error ? error.message : String(error),
    'An unexpected error occurred while reading Aave V4 data.',
    false,
  );
}

async function readOrClassify<T>(fn: () => Promise<T>): Promise<AaveV4RpcResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: classifyError(error) };
  }
}

export async function fetchAssetId(
  client: AaveV4RpcClient,
  hub: `0x${string}`,
  underlying: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<bigint>> {
  return readOrClassify(() =>
    client.readContract({
      address: hub,
      abi: hubGetAssetIdAbi,
      functionName: 'getAssetId',
      args: [underlying],
      blockNumber,
    }),
  );
}

export async function fetchAssetDrawnRate(
  client: AaveV4RpcClient,
  hub: `0x${string}`,
  assetId: bigint,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<bigint>> {
  return readOrClassify(() =>
    client.readContract({
      address: hub,
      abi: hubGetAssetDrawnRateAbi,
      functionName: 'getAssetDrawnRate',
      args: [assetId],
      blockNumber,
    }),
  );
}

export async function fetchReserveId(
  client: AaveV4RpcClient,
  spoke: `0x${string}`,
  hub: `0x${string}`,
  assetId: bigint,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<bigint>> {
  return readOrClassify(() =>
    client.readContract({
      address: spoke,
      abi: spokeGetReserveIdAbi,
      functionName: 'getReserveId',
      args: [hub, assetId],
      blockNumber,
    }),
  );
}

export interface UserDebt {
  drawnDebt: bigint;
  premiumDebt: bigint;
}

export async function fetchUserDebt(
  client: AaveV4RpcClient,
  spoke: `0x${string}`,
  reserveId: bigint,
  user: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<UserDebt>> {
  return readOrClassify(async () => {
    const [drawnDebt, premiumDebt] = await client.readContract({
      address: spoke,
      abi: spokeGetUserDebtAbi,
      functionName: 'getUserDebt',
      args: [reserveId, user],
      blockNumber,
    });
    return { drawnDebt, premiumDebt };
  });
}

export async function fetchUserLastRiskPremium(
  client: AaveV4RpcClient,
  spoke: `0x${string}`,
  user: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<bigint>> {
  return readOrClassify(() =>
    client.readContract({
      address: spoke,
      abi: spokeGetUserLastRiskPremiumAbi,
      functionName: 'getUserLastRiskPremium',
      args: [user],
      blockNumber,
    }),
  );
}

export interface UserReserveStatus {
  usingAsCollateral: boolean;
  borrowed: boolean;
}

export async function fetchUserReserveStatus(
  client: AaveV4RpcClient,
  spoke: `0x${string}`,
  reserveId: bigint,
  user: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<UserReserveStatus>> {
  return readOrClassify(async () => {
    const [usingAsCollateral, borrowed] = await client.readContract({
      address: spoke,
      abi: spokeGetUserReserveStatusAbi,
      functionName: 'getUserReserveStatus',
      args: [reserveId, user],
      blockNumber,
    });
    return { usingAsCollateral, borrowed };
  });
}

export interface Reserve {
  underlying: `0x${string}`;
  hub: `0x${string}`;
  assetId: number;
  decimals: number;
  collateralRisk: number;
  flags: number;
  dynamicConfigKey: number;
}

export async function fetchReserve(
  client: AaveV4RpcClient,
  spoke: `0x${string}`,
  reserveId: bigint,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<Reserve>> {
  return readOrClassify(async () => {
    const reserve = await client.readContract({
      address: spoke,
      abi: spokeGetReserveAbi,
      functionName: 'getReserve',
      args: [reserveId],
      blockNumber,
    });
    return {
      underlying: reserve.underlying,
      hub: reserve.hub,
      assetId: reserve.assetId,
      decimals: reserve.decimals,
      collateralRisk: reserve.collateralRisk,
      flags: reserve.flags,
      dynamicConfigKey: reserve.dynamicConfigKey,
    };
  });
}

/**
 * `ISpoke.getUserPosition` result — V4 Readiness Audit §12 Stage 23C.
 * Only `dynamicConfigKey` (the user's own bound dynamic-config snapshot
 * — see `./abi.ts`'s own header comment for why this, not the reserve's
 * current key, is what `getDynamicReserveConfig` below must be called
 * with) is exposed; the other four `UserPosition` fields are decoded by
 * viem but not currently consumed by any caller.
 */
export interface UserPosition {
  dynamicConfigKey: number;
}

export async function fetchUserPosition(
  client: AaveV4RpcClient,
  spoke: `0x${string}`,
  reserveId: bigint,
  user: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<UserPosition>> {
  return readOrClassify(async () => {
    const position = await client.readContract({
      address: spoke,
      abi: spokeGetUserPositionAbi,
      functionName: 'getUserPosition',
      args: [reserveId, user],
      blockNumber,
    });
    return { dynamicConfigKey: position.dynamicConfigKey };
  });
}

/**
 * `ISpoke.getDynamicReserveConfig` result — V4 Readiness Audit §12 Stage
 * 23C. Only `collateralFactor` is exposed for now; `maxLiquidationBonus`/
 * `liquidationFee` are decoded by viem but not currently consumed — see
 * `services/portfolio/models.ts`'s `AaveV4CollateralRiskConfig` for why
 * they were deliberately excluded from this stage's canonical data
 * model (Stage 23B: neither feeds Health Factor/LTV/liquidation-price).
 */
export interface DynamicReserveConfig {
  collateralFactor: number;
}

/**
 * Caller MUST supply the user's own bound `dynamicConfigKey`
 * (`UserPosition.dynamicConfigKey`, via `fetchUserPosition` above) — this
 * function never substitutes the reserve's current
 * `Reserve.dynamicConfigKey` on its own. `ISpoke.getDynamicReserveConfig`
 * does not revert for an unset/uninitialized key; it returns a zeroed
 * struct, which is passed through unchanged (a real on-chain answer, not
 * a failure this adapter should reinterpret).
 */
export async function fetchDynamicReserveConfig(
  client: AaveV4RpcClient,
  spoke: `0x${string}`,
  reserveId: bigint,
  dynamicConfigKey: number,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<DynamicReserveConfig>> {
  return readOrClassify(async () => {
    const config = await client.readContract({
      address: spoke,
      abi: spokeGetDynamicReserveConfigAbi,
      functionName: 'getDynamicReserveConfig',
      args: [reserveId, dynamicConfigKey],
      blockNumber,
    });
    return { collateralFactor: config.collateralFactor };
  });
}

export async function fetchTokenDecimals(
  client: AaveV4RpcClient,
  tokenAddress: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<number>> {
  return readOrClassify(() =>
    client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals',
      blockNumber,
    }),
  );
}

/**
 * `ISpoke.ORACLE()` — the address of the Spoke's own bound price oracle
 * (V4 Readiness Audit §12 P1-B). See `./abi.ts`'s `spokeOracleAbi` header
 * comment for why this must be read per-Spoke rather than hardcoded or
 * assumed shared with V3.
 */
export async function fetchOracleAddress(
  client: AaveV4RpcClient,
  spoke: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<`0x${string}`>> {
  return readOrClassify(() =>
    client.readContract({
      address: spoke,
      abi: spokeOracleAbi,
      functionName: 'ORACLE',
      blockNumber,
    }),
  );
}

/**
 * `IPriceOracle.decimals()` — read live, never hardcoded, per this
 * stage's own instruction not to bake in the reference implementation's
 * `SpokeUtils.ORACLE_DECIMALS = 8` constant.
 */
export async function fetchOracleDecimals(
  client: AaveV4RpcClient,
  oracle: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<number>> {
  return readOrClassify(() =>
    client.readContract({
      address: oracle,
      abi: priceOracleAbi,
      functionName: 'decimals',
      blockNumber,
    }),
  );
}

/**
 * `IPriceOracle.getReservePrice(reserveId)` — the caller supplies the
 * SAME `reserveId` already resolved by `resolveV4Reserve` (`./index.ts`)
 * for `getUserPosition`/`getDynamicReserveConfig`; this function performs
 * no reserve resolution of its own. Reverts (never returns a sentinel
 * zero) if the price is not greater than 0, or if no price feed source is
 * configured for this reserve — both fall through `classifyError` to
 * `AAVE_V4_RPC_CONTRACT_ERROR`, a genuine failure, never silently
 * substituted with 0/$1/a cached value.
 */
export async function fetchReservePrice(
  client: AaveV4RpcClient,
  oracle: `0x${string}`,
  reserveId: bigint,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<bigint>> {
  return readOrClassify(() =>
    client.readContract({
      address: oracle,
      abi: priceOracleAbi,
      functionName: 'getReservePrice',
      args: [reserveId],
      blockNumber,
    }),
  );
}

export interface PinnedBlock {
  number: bigint;
  timestamp: bigint;
}

/**
 * Fetches block number and timestamp together, from the same underlying
 * `eth_getBlockByNumber` response — see this file's own `AaveV4RpcClient`
 * doc comment for why this replaces a separate `getBlockNumber` call
 * (Stage 3 hardening review item 4).
 */
export async function fetchPinnedBlock(
  client: AaveV4RpcClient,
  blockNumber?: bigint,
): Promise<AaveV4RpcResult<PinnedBlock>> {
  return readOrClassify(async () => {
    const block = await client.getBlock(blockNumber !== undefined ? { blockNumber } : undefined);
    return { number: block.number, timestamp: block.timestamp };
  });
}
