import type { RawPriceCandidate } from '@/services/market/quote';
import type { RawProtocolCandidate } from '@/services/protocol/quote';

import { basisPointsToDecimal, deriveUsdPrice, rayToDecimal } from './scale';
import type { AaveMarketConfig, RawAaveReserve } from './types';

/**
 * Maps raw Aave V3 subgraph reserves into the exact candidate shapes
 * `services/market/quote.ts`'s `normalizeMarketQuote` and
 * `services/protocol/quote.ts`'s `normalizeProtocolQuote` already
 * consume — this Infrastructure layer's whole job is producing one more
 * `origin: 'provider'`/`'live'` candidate for those pre-existing,
 * unmodified Service functions, per `04_BUILD_GUIDE.md`'s "keep
 * API-specific data out of the Engine" and "map provider data into
 * existing service/domain types."
 *
 * The collateral reserve (WBTC) supplies the price, max LTV, and
 * liquidation threshold — all collateral-side risk parameters. The
 * borrow reserve (USDC) supplies the borrow rate actually charged on
 * the debt ProfitPilot's portfolios carry. WBTC's own `liquidityRate`
 * (its supply APR) is reported too, since M3-008's `ProtocolParameters`
 * requires it, even though ProfitPilot's current formulas don't
 * separately consume a collateral-side supply rate.
 */
export interface MappedAaveData {
  priceCandidate: RawPriceCandidate;
  protocolCandidate: RawProtocolCandidate;
  collateralSymbol: string;
  borrowSymbol: string;
}

export interface MapAaveReservesError {
  code: string;
  message: string;
}

export type MapAaveReservesResult =
  { ok: true; data: MappedAaveData } | { ok: false; error: MapAaveReservesError };

export function mapAaveReserves(
  reserves: RawAaveReserve[],
  config: AaveMarketConfig,
): MapAaveReservesResult {
  const collateralReserve = reserves.find((reserve) => reserve.symbol === config.collateralSymbol);
  if (collateralReserve === undefined) {
    return {
      ok: false,
      error: {
        code: 'AAVE_COLLATERAL_RESERVE_NOT_FOUND',
        message: `Collateral reserve "${config.collateralSymbol}" was not present in the Aave subgraph response.`,
      },
    };
  }

  const borrowReserve = reserves.find((reserve) => reserve.symbol === config.borrowSymbol);
  if (borrowReserve === undefined) {
    return {
      ok: false,
      error: {
        code: 'AAVE_BORROW_RESERVE_NOT_FOUND',
        message: `Borrow reserve "${config.borrowSymbol}" was not present in the Aave subgraph response.`,
      },
    };
  }

  const timestamp = new Date(collateralReserve.lastUpdateTimestamp * 1000).toISOString();

  const priceCandidate: RawPriceCandidate = {
    origin: 'provider',
    price: deriveUsdPrice(
      collateralReserve.price.priceInEth,
      collateralReserve.price.oracle.usdPriceEth,
    ),
    timestamp,
  };

  const protocolCandidate: RawProtocolCandidate = {
    origin: 'live',
    timestamp,
    parameters: {
      maxLoanToValue: basisPointsToDecimal(collateralReserve.baseLTVasCollateral),
      liquidationThreshold: basisPointsToDecimal(collateralReserve.reserveLiquidationThreshold),
      borrowApr: rayToDecimal(borrowReserve.variableBorrowRate),
      supplyApr: rayToDecimal(collateralReserve.liquidityRate),
    },
  };

  return {
    ok: true,
    data: {
      priceCandidate,
      protocolCandidate,
      collateralSymbol: config.collateralSymbol,
      borrowSymbol: config.borrowSymbol,
    },
  };
}
