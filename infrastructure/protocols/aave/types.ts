/**
 * Aave V3 subgraph wire types — Phase 1 read-only live-data integration.
 *
 * **Why the classic `aave/protocol-subgraphs` V3 subgraph, not AaveKit.**
 * Aave's current official GraphQL tooling is AaveKit (`@aave/client`,
 * repo `aave/aave-v4-sdk`), but that surface serves **Protocol V4**
 * data — the Hub/Spoke architecture, where each reserve carries a
 * single `collateralFactor` risk parameter. ProfitPilot's domain model
 * (`ProtocolParameters` in `engine/`) requires two distinct figures —
 * `maxLoanToValue` and `liquidationThreshold` — which V4's single
 * `collateralFactor` cannot supply. Aave's own, still-officially-
 * published V3 subgraph (`aave/protocol-subgraphs`, queried through The
 * Graph's Gateway) exposes both (`baseLTVasCollateral` and
 * `reserveLiquidationThreshold`) directly, and is the genuine Protocol
 * V3 data source ProfitPilot's existing model already assumes. See
 * `client.ts`'s own header for the exact endpoint and the API-key
 * dependency this introduces.
 *
 * All numeric wire fields arrive as strings (the subgraph encodes
 * uint256/RAY-scaled values this way to avoid float precision loss in
 * transit) — `scale.ts` converts them into the plain decimals
 * ProfitPilot's domain types expect.
 */
export interface RawAaveReserve {
  id: string;
  symbol: string;
  decimals: number;
  /** Basis points, e.g. "7300" = 73.00%. */
  baseLTVasCollateral: string;
  /** Basis points, e.g. "7800" = 78.00%. */
  reserveLiquidationThreshold: string;
  /** RAY-scaled (10^27), documented by Aave as APR (non-compounding). */
  variableBorrowRate: string;
  /** RAY-scaled (10^27), documented by Aave as APR (non-compounding). */
  liquidityRate: string;
  /** Unix seconds. */
  lastUpdateTimestamp: number;
  price: {
    /** Wei-scaled (10^18) price of this asset denominated in ETH. */
    priceInEth: string;
    oracle: {
      /** 8-decimal-scaled USD price of ETH itself. */
      usdPriceEth: string;
    };
  };
}

export interface AaveReservesResponse {
  data: {
    reserves: RawAaveReserve[];
  };
}

export interface AaveMarketConfig {
  chainName: string;
  subgraphId: string;
  /** Aave-side reserve symbol used as collateral (may differ from ProfitPilot's own asset symbol, e.g. "WBTC" vs "BTC"). */
  collateralSymbol: string;
  /** Aave-side reserve symbol used as the borrow/debt asset. */
  borrowSymbol: string;
}
