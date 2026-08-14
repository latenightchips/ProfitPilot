export const AAVE_RESERVES_QUERY = `
  query ProfitPilotReserves($symbols: [String!]!) {
    reserves(where: { symbol_in: $symbols }) {
      id
      symbol
      decimals
      baseLTVasCollateral
      reserveLiquidationThreshold
      variableBorrowRate
      liquidityRate
      lastUpdateTimestamp
      price {
        priceInEth
        oracle {
          usdPriceEth
        }
      }
    }
  }
`;

export function buildAaveReservesVariables(collateralSymbol: string, borrowSymbol: string) {
  return { symbols: [collateralSymbol, borrowSymbol] };
}
