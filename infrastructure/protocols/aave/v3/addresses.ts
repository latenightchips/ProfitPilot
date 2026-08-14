/**
 * Aave V3 Ethereum Mainnet addresses — verified against `aave-address-book`
 * (`aave-dao/aave-address-book`, `AaveV3Ethereum.sol`). Version 0.1 scope:
 * WBTC collateral / USDC debt only (01_PRD.md REQ-003).
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
} as const;

export const AAVE_V3_ETHEREUM_MARKET = {
  network: 'Ethereum Mainnet',
  collateralAsset: AAVE_V3_ETHEREUM_ASSETS.WBTC,
  borrowAsset: AAVE_V3_ETHEREUM_ASSETS.USDC,
} as const;

export const AAVE_V3_DEFAULT_RPC_URL = 'https://ethereum-rpc.publicnode.com';
