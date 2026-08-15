/**
 * Aave V3 Ethereum Mainnet addresses — verified against `aave-address-book`
 * (`aave-dao/aave-address-book`, `AaveV3Ethereum.sol`). Collateral scope
 * remains WBTC only (01_PRD.md REQ-003). Borrow-side scope: USDC and USDT
 * (USDT Support milestone) — both addresses/decimals verified against the
 * same `aave-address-book` `AaveV3EthereumAssets.sol` source already used
 * for USDC/WBTC above, not from memory. DAI is intentionally absent: the
 * portfolio schema (`types/portfolio.ts`) allows DAI as a debt asset, but
 * no live Aave DAI reserve support has been implemented yet — `v3/index.ts`'s
 * `isLiveBorrowAsset` fails closed for it rather than silently substituting
 * another asset's data.
 */
export const AAVE_V3_ETHEREUM_CONTRACTS = {
  pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  poolDataProvider: '0x0a16f2FCC0D44FaE41cc54e079281D84A363bECD',
  oracle: '0x54586bE62E3c3580375aE3723C145253060Ca0C2',
} as const;

export const AAVE_V3_ETHEREUM_ASSETS = {
  WBTC: {
    symbol: 'WBTC',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
  },
  USDC: {
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    decimals: 6,
  },
  USDT: {
    symbol: 'USDT',
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    decimals: 6,
  },
} as const;

export const AAVE_V3_ETHEREUM_MARKET = {
  network: 'Ethereum Mainnet',
  collateralAsset: AAVE_V3_ETHEREUM_ASSETS.WBTC,
} as const;

/**
 * Table-driven registry of the borrow assets this milestone supports live
 * data for — USDC and USDT only (see this file's own header comment for
 * why DAI is deliberately absent). `v3/index.ts`'s `isLiveBorrowAsset`
 * type predicate and `fetchAaveV3ReserveSnapshot` both key off this map
 * rather than branching on asset symbol.
 */
export const AAVE_V3_ETHEREUM_BORROW_ASSETS = {
  USDC: AAVE_V3_ETHEREUM_ASSETS.USDC,
  USDT: AAVE_V3_ETHEREUM_ASSETS.USDT,
} as const;

export type AaveV3LiveBorrowAssetSymbol = keyof typeof AAVE_V3_ETHEREUM_BORROW_ASSETS;

export const AAVE_V3_DEFAULT_RPC_URL = 'https://ethereum-rpc.publicnode.com';
