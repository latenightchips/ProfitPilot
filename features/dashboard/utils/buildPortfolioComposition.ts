/**
 * Portfolio Composition builder — 06_TASKS.md M5-011. See
 * `../types/portfolioComposition.ts` for the full design reasoning
 * (100% portfolio percentages and M5-012's no-new-code resolution, both
 * structural consequences of Conflict A).
 */
import { deriveAaveV4EffectiveBorrowRate, type PortfolioSummary } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type { PortfolioComposition } from '../types/portfolioComposition';
import type { DashboardMarketFreshness } from '../types/viewModel';
import { formatCurrency, formatPercent, formatQuantity } from './format';

const ALWAYS_100_PERCENT = formatPercent(1);

/** Matches `buildDebtAndInterestPanel.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

/**
 * "Borrow APR" — V4 Readiness Audit §12 Stage 15. `portfolio.protocol.borrowApr`
 * is a legacy V3-shaped scalar with no defined relationship to a V4
 * position's real two-parameter rate (`baseDrawnApr` + `riskPremium`) —
 * see `services/portfolio/mapping.ts`'s `deriveAaveV4EffectiveBorrowRate`
 * for the full reasoning. For a V4 portfolio, this now derives the real
 * rate from synced `v4DebtState` instead; `'—'` (never a fabricated or
 * stale V3 number) when that state is absent, invalid, or the derivation
 * itself fails — the same fail-closed convention already used elsewhere
 * on this Dashboard for a missing/invalid value.
 */
function formatBorrowRate(
  portfolio: Portfolio,
  tracked: { engineVersion: string; formulaVersion: string },
): string {
  if (portfolio.protocolVersion !== 'v4') {
    return formatPercent(portfolio.protocol.borrowApr);
  }
  if (portfolio.v4DebtState === undefined) return '—';
  const rateStep = deriveAaveV4EffectiveBorrowRate(portfolio.v4DebtState, tracked, SOURCE_STATUS);
  return rateStep.ok ? formatPercent(rateStep.value) : '—';
}

export function buildPortfolioComposition(
  portfolio: Portfolio,
  summary: PortfolioSummary,
  marketFreshness: DashboardMarketFreshness | null,
  tracked: { engineVersion: string; formulaVersion: string },
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
      formattedBorrowApr: formatBorrowRate(portfolio, tracked),
      formattedSupplyApr: formatPercent(portfolio.protocol.supplyApr),
    },
    showAllocationChart: false,
  };
}
