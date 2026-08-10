/**
 * Portfolio Composition builder — 06_TASKS.md M5-011. See
 * `../types/portfolioComposition.ts` for the full design reasoning
 * (100% portfolio percentages and M5-012's no-new-code resolution, both
 * structural consequences of Conflict A).
 */
import type { PortfolioSummary } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type { PortfolioComposition } from '../types/portfolioComposition';
import type { DashboardMarketFreshness } from '../types/viewModel';
import { formatCurrency, formatPercent, formatQuantity } from './format';

const ALWAYS_100_PERCENT = formatPercent(1);

export function buildPortfolioComposition(
  portfolio: Portfolio,
  summary: PortfolioSummary,
  marketFreshness: DashboardMarketFreshness | null,
): PortfolioComposition {
  return {
    collateral: {
      assetLabel: portfolio.collateral.asset,
      formattedQuantity: formatQuantity(portfolio.collateral.quantity),
      formattedCurrentPrice:
        marketFreshness?.formattedPrice ?? formatCurrency(portfolio.market.btcPriceUsd),
      formattedPositionValue: formatCurrency(summary.collateralValue),
      formattedPortfolioPercentage: ALWAYS_100_PERCENT,
    },
    debt: {
      assetLabel: portfolio.debt.asset,
      formattedQuantity: formatQuantity(portfolio.debt.balance),
      formattedCurrentPrice: '$1.00 (stablecoin)',
      formattedPositionValue: formatCurrency(summary.debtValue),
      formattedPortfolioPercentage: ALWAYS_100_PERCENT,
    },
    protocolParameters: {
      formattedMaxLoanToValue: formatPercent(portfolio.protocol.maxLoanToValue),
      formattedLiquidationThreshold: formatPercent(portfolio.protocol.liquidationThreshold),
      formattedBorrowApr: formatPercent(portfolio.protocol.borrowApr),
      formattedSupplyApr: formatPercent(portfolio.protocol.supplyApr),
    },
    showAllocationChart: false,
  };
}
