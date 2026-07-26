/**
 * Dashboard View Model builder — 06_TASKS.md M5-003. See
 * `../types/viewModel.ts` for the full design reasoning (Conflict #1
 * scoping, Formula ID sourcing). This function performs the actual
 * conversion: `Portfolio` + `ServiceResult<PortfolioSummary>` (M3-005) →
 * `DashboardViewModel`.
 *
 * **Units, read directly from `docs/02_Formulas.md`, not assumed:**
 * - F-020 LTV and F-004/F-002/F-003/F-032 (equity/collateral/debt/interest)
 *   are already the "real" units (a 0–1 fraction, USD) `formatPercent`/
 *   `formatCurrency` expect.
 * - F-023 Distance to Liquidation is `healthFactor − 1.0`, a raw ratio,
 *   not a percentage — uses `formatNumber`, matching Health Factor's own
 *   plain-number formatting.
 * - F-025 Liquidation Buffer's own equation already multiplies by 100
 *   ("Buffer % = ... × 100") before `calculateLiquidationBuffer` returns
 *   it — `formatPercentagePoints` divides by 100 again before handing it
 *   to `Intl`'s percent formatter, rather than double-applying the ×100
 *   `formatPercent` would if used directly on an already-scaled value.
 *
 * **`base` (identity + freshness) is built unconditionally, before the
 * `summaryResult.ok` check — added in Batch 2 (M5-004)**: unlike
 * `PortfolioSummary`'s fields, market/protocol freshness and portfolio
 * identity are derived from `Portfolio` alone (`normalizeMarketQuote`/
 * `normalizeProtocolQuote`), never from the Engine calculation — so they
 * remain available even when `summaryResult.ok` is `false`, letting
 * `DashboardSummaryHeader` show "which portfolio and data source are
 * currently active" (M5-004's own DoD) regardless of calculation status.
 */
import {
  normalizeMarketQuote,
  normalizeProtocolQuote,
  type PortfolioSummary,
  type ServiceResult,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type {
  DashboardFreshness,
  DashboardMetric,
  DashboardMetrics,
  DashboardMetricStatus,
  DashboardViewModel,
  DashboardViewModelBase,
} from '../types/viewModel';
import {
  formatCurrency,
  formatDateTime,
  formatHealthFactor,
  formatLeverage,
  formatNumber,
  formatPercent,
  formatPercentagePoints,
} from './format';

function metric(
  label: string,
  rawValue: number | null,
  formattedValue: string,
  formulaId: string,
): DashboardMetric {
  const status: DashboardMetricStatus = rawValue === null ? 'unavailable' : 'ok';
  return {
    label,
    rawValue,
    formattedValue,
    status,
    formulaId: rawValue === null ? null : formulaId,
  };
}

/**
 * Reuses `normalizeMarketQuote` (M3-007) exactly as `app/portfolio/page.tsx`'s
 * own `getMarketQuote` does — same single-manual-candidate shape, same
 * Service-owned staleness threshold, not re-derived here. Returns `null`
 * only on the practically-unreachable `MappingFailure`/`'unavailable'`
 * case (`portfolio.market.btcPriceUsd` is already Zod-validated,
 * `marketUpdatedAt` is always a Store-generated ISO string).
 */
function buildMarketFreshness(portfolio: Portfolio): DashboardFreshness['market'] {
  const result = normalizeMarketQuote({
    asset: portfolio.collateral.asset,
    currency: 'USD',
    candidates: [
      {
        origin: 'manual',
        price: portfolio.market.btcPriceUsd,
        timestamp: portfolio.marketUpdatedAt,
      },
    ],
    now: new Date().toISOString(),
  });
  if (!result.ok || result.data.freshness === 'unavailable') return null;
  return {
    price: result.data.price,
    formattedPrice: formatCurrency(result.data.price),
    origin: result.data.origin,
    freshness: result.data.freshness,
    updatedAt: portfolio.marketUpdatedAt,
    formattedUpdatedAt: formatDateTime(portfolio.marketUpdatedAt),
  };
}

/** Mirrors `buildMarketFreshness` for `normalizeProtocolQuote` (M3-008) — no freshness concept exists for protocol parameters, only `origin`/`timestamp` (see this module's own header comment). */
function buildProtocolFreshness(portfolio: Portfolio): DashboardFreshness['protocol'] {
  const result = normalizeProtocolQuote({
    collateralAsset: portfolio.collateral.asset,
    borrowAsset: portfolio.debt.asset,
    candidates: [
      { origin: 'manual', parameters: portfolio.protocol, timestamp: portfolio.protocolUpdatedAt },
    ],
  });
  if (!result.ok || !result.data.available) return null;
  return {
    origin: result.data.origin,
    updatedAt: portfolio.protocolUpdatedAt,
    formattedUpdatedAt: formatDateTime(portfolio.protocolUpdatedAt),
  };
}

/**
 * Builds the one stable typed model every Dashboard component consumes —
 * 06_TASKS.md M5-003's own DoD. Never calculates a financial metric
 * itself (every number is read off an already-computed `PortfolioSummary`)
 * and never mutates `summaryResult` (only new objects are constructed).
 */
export function buildDashboardViewModel(
  portfolio: Portfolio,
  summaryResult: ServiceResult<PortfolioSummary>,
): DashboardViewModel {
  const base: DashboardViewModelBase = {
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    portfolioDescription: portfolio.description ?? null,
    freshness: {
      market: buildMarketFreshness(portfolio),
      protocol: buildProtocolFreshness(portfolio),
    },
  };

  if (!summaryResult.ok) {
    return { ...base, ok: false, errors: summaryResult.errors };
  }

  const summary = summaryResult.data;
  const liquidation = summary.liquidation;
  const liquidationMetrics: Pick<
    DashboardMetrics,
    'liquidationPrice' | 'liquidationDistance' | 'liquidationBuffer'
  > =
    liquidation === null
      ? {
          liquidationPrice: metric('Liquidation Price', null, 'N/A (no debt)', 'F-024'),
          liquidationDistance: metric('Distance to Liquidation', null, 'N/A (no debt)', 'F-023'),
          liquidationBuffer: metric('Liquidation Buffer', null, 'N/A (no debt)', 'F-025'),
        }
      : {
          liquidationPrice: metric(
            'Liquidation Price',
            liquidation.price,
            formatCurrency(liquidation.price),
            'F-024',
          ),
          liquidationDistance: metric(
            'Distance to Liquidation',
            liquidation.distance,
            formatNumber(liquidation.distance),
            'F-023',
          ),
          liquidationBuffer: metric(
            'Liquidation Buffer',
            liquidation.buffer,
            formatPercentagePoints(liquidation.buffer),
            'F-025',
          ),
        };

  const metrics: DashboardMetrics = {
    netPortfolioValue: metric(
      'Net Portfolio Value',
      summary.netEquity,
      formatCurrency(summary.netEquity),
      'F-004',
    ),
    totalCollateral: metric(
      'Total Collateral',
      summary.collateralValue,
      formatCurrency(summary.collateralValue),
      'F-002',
    ),
    totalDebt: metric('Total Debt', summary.debtValue, formatCurrency(summary.debtValue), 'F-003'),
    healthFactor: metric(
      'Health Factor',
      summary.healthFactor,
      formatHealthFactor(summary.healthFactor),
      'F-022',
    ),
    loanToValue: metric(
      'Loan-to-Value',
      summary.loanToValue,
      formatPercent(summary.loanToValue),
      'F-020',
    ),
    leverage: metric(
      'Effective Leverage',
      summary.leverage,
      formatLeverage(summary.leverage),
      'F-011',
    ),
    annualInterestCost: metric(
      'Annual Interest Cost',
      summary.interestCost,
      formatCurrency(summary.interestCost),
      'F-032',
    ),
    ...liquidationMetrics,
  };

  return {
    ...base,
    ok: true,
    metrics,
    warnings: summaryResult.warnings,
    calculationTimestamp: summaryResult.metadata.calculationTimestamp,
    formattedCalculationTimestamp: formatDateTime(summaryResult.metadata.calculationTimestamp),
  };
}
