import {
  BaseError,
  createPublicClient,
  http,
  HttpRequestError,
  type PublicClient,
  TimeoutError,
} from 'viem';
import { mainnet } from 'viem/chains';

import { aaveOracleAbi, erc20Abi, poolAbi, poolDataProviderAbi } from './abi';
import { AAVE_V3_ETHEREUM_CONTRACTS } from './addresses';

const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

/** Only the read surface this adapter needs — keeps the injectable client mockable in tests. */
export type AaveV3RpcClient = Pick<PublicClient, 'readContract' | 'getBlockNumber'>;

export function createAaveV3RpcClient(rpcUrl: string): AaveV3RpcClient {
  return createPublicClient({
    chain: mainnet,
    transport: http(rpcUrl, { timeout: TIMEOUT_MS, retryCount: MAX_RETRIES, retryDelay: 500 }),
  });
}

export interface AaveV3ProviderError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
}

export type AaveV3RpcResult<T> = { ok: true; data: T } | { ok: false; error: AaveV3ProviderError };

function providerError(
  code: string,
  message: string,
  userMessage: string,
  retryable: boolean,
): AaveV3ProviderError {
  return { code, message, userMessage, retryable };
}

/**
 * Classifies an RPC failure by walking viem's own cause chain
 * (`BaseError.walk`) rather than checking the outermost error type.
 * `readContract` wraps genuine network failures several levels deep
 * (e.g. `ContractFunctionExecutionError -> CallExecutionError ->
 * HttpRequestError`), so checking only the outer type misclassifies a
 * retryable network failure as a non-retryable contract error.
 */
function classifyError(error: unknown): AaveV3ProviderError {
  if (error instanceof BaseError) {
    const timeoutCause = error.walk((cause) => cause instanceof TimeoutError);
    if (timeoutCause) {
      return providerError(
        'AAVE_RPC_TIMEOUT',
        `RPC request timed out: ${error.shortMessage}`,
        'The Aave data request timed out. Please try again.',
        true,
      );
    }

    const httpCause = error.walk((cause) => cause instanceof HttpRequestError);
    if (httpCause instanceof HttpRequestError) {
      return providerError(
        'AAVE_RPC_NETWORK_ERROR',
        `RPC network error: ${httpCause.shortMessage}`,
        'Could not reach the Ethereum RPC endpoint. Please try again.',
        true,
      );
    }

    return providerError(
      'AAVE_RPC_CONTRACT_ERROR',
      `Contract call failed: ${error.shortMessage}`,
      'Aave returned an unexpected response. Please try again later.',
      false,
    );
  }

  return providerError(
    'AAVE_RPC_UNKNOWN_ERROR',
    error instanceof Error ? error.message : String(error),
    'An unexpected error occurred while reading Aave data.',
    false,
  );
}

async function readOrClassify<T>(fn: () => Promise<T>): Promise<AaveV3RpcResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: classifyError(error) };
  }
}

export interface ReserveConfigurationData {
  decimals: bigint;
  ltv: bigint;
  liquidationThreshold: bigint;
  liquidationBonus: bigint;
  reserveFactor: bigint;
  usageAsCollateralEnabled: boolean;
  borrowingEnabled: boolean;
  stableBorrowRateEnabled: boolean;
  isActive: boolean;
  isFrozen: boolean;
}

export interface ReserveData {
  unbacked: bigint;
  accruedToTreasuryScaled: bigint;
  totalAToken: bigint;
  totalStableDebt: bigint;
  totalVariableDebt: bigint;
  liquidityRate: bigint;
  variableBorrowRate: bigint;
  stableBorrowRate: bigint;
  averageStableBorrowRate: bigint;
  liquidityIndex: bigint;
  variableBorrowIndex: bigint;
  lastUpdateTimestamp: number;
}

export interface AssetPrice {
  price: bigint;
  baseCurrencyUnit: bigint;
}

export interface UserAccountData {
  totalCollateralBase: bigint;
  totalDebtBase: bigint;
  availableBorrowsBase: bigint;
  currentLiquidationThreshold: bigint;
  ltv: bigint;
  healthFactor: bigint;
}

export async function fetchReserveConfigurationData(
  client: AaveV3RpcClient,
  asset: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV3RpcResult<ReserveConfigurationData>> {
  return readOrClassify(async () => {
    const [
      decimals,
      ltv,
      liquidationThreshold,
      liquidationBonus,
      reserveFactor,
      usageAsCollateralEnabled,
      borrowingEnabled,
      stableBorrowRateEnabled,
      isActive,
      isFrozen,
    ] = await client.readContract({
      address: AAVE_V3_ETHEREUM_CONTRACTS.poolDataProvider,
      abi: poolDataProviderAbi,
      functionName: 'getReserveConfigurationData',
      args: [asset],
      blockNumber,
    });
    return {
      decimals,
      ltv,
      liquidationThreshold,
      liquidationBonus,
      reserveFactor,
      usageAsCollateralEnabled,
      borrowingEnabled,
      stableBorrowRateEnabled,
      isActive,
      isFrozen,
    };
  });
}

export async function fetchReserveData(
  client: AaveV3RpcClient,
  asset: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV3RpcResult<ReserveData>> {
  return readOrClassify(async () => {
    const [
      unbacked,
      accruedToTreasuryScaled,
      totalAToken,
      totalStableDebt,
      totalVariableDebt,
      liquidityRate,
      variableBorrowRate,
      stableBorrowRate,
      averageStableBorrowRate,
      liquidityIndex,
      variableBorrowIndex,
      lastUpdateTimestamp,
    ] = await client.readContract({
      address: AAVE_V3_ETHEREUM_CONTRACTS.poolDataProvider,
      abi: poolDataProviderAbi,
      functionName: 'getReserveData',
      args: [asset],
      blockNumber,
    });
    return {
      unbacked,
      accruedToTreasuryScaled,
      totalAToken,
      totalStableDebt,
      totalVariableDebt,
      liquidityRate,
      variableBorrowRate,
      stableBorrowRate,
      averageStableBorrowRate,
      liquidityIndex,
      variableBorrowIndex,
      lastUpdateTimestamp,
    };
  });
}

export async function fetchAssetPrice(
  client: AaveV3RpcClient,
  asset: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV3RpcResult<AssetPrice>> {
  return readOrClassify(async () => {
    const [price, baseCurrencyUnit] = await Promise.all([
      client.readContract({
        address: AAVE_V3_ETHEREUM_CONTRACTS.oracle,
        abi: aaveOracleAbi,
        functionName: 'getAssetPrice',
        args: [asset],
        blockNumber,
      }),
      client.readContract({
        address: AAVE_V3_ETHEREUM_CONTRACTS.oracle,
        abi: aaveOracleAbi,
        functionName: 'BASE_CURRENCY_UNIT',
        blockNumber,
      }),
    ]);
    return { price, baseCurrencyUnit };
  });
}

export async function fetchUserAccountData(
  client: AaveV3RpcClient,
  user: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV3RpcResult<UserAccountData>> {
  return readOrClassify(async () => {
    const [
      totalCollateralBase,
      totalDebtBase,
      availableBorrowsBase,
      currentLiquidationThreshold,
      ltv,
      healthFactor,
    ] = await client.readContract({
      address: AAVE_V3_ETHEREUM_CONTRACTS.pool,
      abi: poolAbi,
      functionName: 'getUserAccountData',
      args: [user],
      blockNumber,
    });
    return {
      totalCollateralBase,
      totalDebtBase,
      availableBorrowsBase,
      currentLiquidationThreshold,
      ltv,
      healthFactor,
    };
  });
}

export async function fetchTokenDecimals(
  client: AaveV3RpcClient,
  tokenAddress: `0x${string}`,
  blockNumber?: bigint,
): Promise<AaveV3RpcResult<number>> {
  return readOrClassify(async () => {
    const decimals = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals',
      blockNumber,
    });
    return decimals;
  });
}

export async function fetchBlockNumber(client: AaveV3RpcClient): Promise<AaveV3RpcResult<bigint>> {
  return readOrClassify(() => client.getBlockNumber());
}
