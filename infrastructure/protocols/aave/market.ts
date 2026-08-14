import type { AaveMarketConfig } from './types';

/**
 * Phase 1 supports exactly one market/reserve pair — Ethereum Mainnet
 * Aave V3, WBTC collateral / USDC debt — the closest Aave-native match
 * to ProfitPilot's own BTC-collateral / stablecoin-debt test setup.
 * `ApplicationPortfolio.collateral.asset` remains `'BTC'` everywhere
 * else in the app; only this Aave-side query uses the `WBTC` symbol,
 * since that is the actual reserve symbol Aave's V3 market lists.
 *
 * Subgraph ID is Aave's own officially-published V3 Ethereum Mainnet
 * deployment on The Graph's decentralized network.
 */
export const AAVE_V3_ETHEREUM_MAINNET: AaveMarketConfig = {
  chainName: 'Ethereum Mainnet',
  subgraphId: 'Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g',
  collateralSymbol: 'WBTC',
  borrowSymbol: 'USDC',
};
