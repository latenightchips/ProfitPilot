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
 *
 * **`liveAave` (optional 3rd param) — Dashboard Live-State Cleanup
 * batch.** Before this batch, `buildMarketFreshness`/`buildProtocolFreshness`
 * unconditionally tagged every candidate `origin: 'manual'`, a leftover
 * from before the Aave V3 direct-RPC integration existed — by the time
 * that integration shipped, this pure function had no way to know
 * `portfolio.market`/`portfolio.protocol` were in fact being kept in
 * sync with live Aave data by `hooks/useAaveLiveSync.ts`, so it kept
 * reporting "(manual)" on values that were actually live. Callers that
 * have a current `useAaveLiveDataStore` snapshot (`DashboardPageClient`,
 * mirroring what `app/portfolio/PortfolioPageClient.tsx` already reads
 * directly) now pass it through as `liveAave`, and freshness is reported
 * straight off that snapshot — the same one Portfolio's own read-only
 * fields render — rather than re-derived and mislabeled. Three states:
 *   1. `liveAave` omitted entirely (legacy callers/tests) — falls back to
 *      the original portfolio-derived, `origin: 'manual'` behavior,
 *      unchanged, so nothing that doesn't opt in regresses.
 *   2. `liveAave` supplied with an available quote — freshness is read
 *      directly off that quote (price, origin, staleness, timestamp all
 *      Aave-sourced, not re-derived from the stored portfolio).
 *   3. `liveAave` supplied but currently unavailable (never fetched
 *      successfully this session, or the last fetch failed) — falls back
 *      to the portfolio's own last-known stored value, same as case 1,
 *      but tagged `origin: 'cache'` rather than `'manual'`: the caller
 *      told us it *tried* to reach live Aave data, so "last known
 *      cached value" is the honest label, not "manually entered."
 * Never changes what `summaryResult`/`PortfolioSummary` already computed
 * — `portfolio.market`/`portfolio.protocol` (kept in sync by
 * `useAaveLiveSync`'s own equality-gated `update()`) remain the only
 * source of truth for the actual calculated numbers; `liveAave` only
 * affects how the freshness/origin *label* is reported.
 */
import {
  normalizeMarketQuote,
  normalizeProtocolQuote,
  type PortfolioSummary,
  type ServiceResult,
} from '@/services';
import type { PriceOrigin } from '@/services/market/quote';
import type { MarketQuote } from '@/services/market/quote';
import type { ProtocolOrigin, ProtocolQuote } from '@/services/protocol/quote';
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

/** The current `useAaveLiveDataStore` snapshot — see this module's own header comment for the 3-state fallback this drives. */
export interface AaveLiveSnapshot {
  marketQuote: MarketQuote | null;
  protocolQuote: ProtocolQuote | null;
}

/**
 * Reuses `normalizeMarketQuote` (M3-007) exactly as `app/portfolio/page.tsx`'s
 * own `getMarketQuote` does — same single-candidate shape, same
 * Service-owned staleness threshold, not re-derived here. Returns `null`
 * only on the practically-unreachable `MappingFailure`/`'unavailable'`
 * case (`portfolio.market.btcPriceUsd` is already Zod-validated,
 * `marketUpdatedAt` is always a Store-generated ISO string).
 *
 * When `liveAave` carries an available quote, that quote — not the
 * stored portfolio — is the source of truth for what gets reported here
 * (see this module's own header comment).
 */
function buildMarketFreshness(
  portfolio: Portfolio,
  liveAave: AaveLiveSnapshot | undefined,
): DashboardFreshness['market'] {
  const liveQuote = liveAave?.marketQuote;
  if (liveQuote !== null && liveQuote !== undefined && liveQuote.freshness !== 'unavailable') {
    return {
      price: liveQuote.price,
      formattedPrice: formatCurrency(liveQuote.price),
      origin: liveQuote.origin,
      freshness: liveQuote.freshness,
      updatedAt: liveQuote.timestamp,
      formattedUpdatedAt: formatDateTime(liveQuote.timestamp),
    };
  }

  const fallbackOrigin: PriceOrigin = liveAave === undefined ? 'manual' : 'cache';
  const result = normalizeMarketQuote({
    asset: portfolio.collateral.asset,
    currency: 'USD',
    candidates: [
      {
        origin: fallbackOrigin,
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
function buildProtocolFreshness(
  portfolio: Portfolio,
  liveAave: AaveLiveSnapshot | undefined,
): DashboardFreshness['protocol'] {
  const liveQuote = liveAave?.protocolQuote;
  if (liveQuote !== null && liveQuote !== undefined && liveQuote.available) {
    return {
      origin: liveQuote.origin,
      updatedAt: liveQuote.timestamp,
      formattedUpdatedAt: formatDateTime(liveQuote.timestamp),
    };
  }

  const fallbackOrigin: ProtocolOrigin = liveAave === undefined ? 'manual' : 'cache';
  const result = normalizeProtocolQuote({
    collateralAsset: portfolio.collateral.asset,
    borrowAsset: portfolio.debt.asset,
    candidates: [
      {
        origin: fallbackOrigin,
        parameters: portfolio.protocol,
        timestamp: portfolio.protocolUpdatedAt,
      },
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
  liveAave?: AaveLiveSnapshot,
): DashboardViewModel {
  const base: DashboardViewModelBase = {
    portfolioId: portfolio.id,
    portfolioName: portfolio.name,
    portfolioDescription: portfolio.description ?? null,
    freshness: {
      market: buildMarketFreshness(portfolio, liveAave),
      protocol: buildProtocolFreshness(portfolio, liveAave),
    },
  };

  if (!summaryResult.ok) {
    return { ...base, ok: false, errors: summaryResult.errors };
  }

  const summary = summaryResult.data;
  const liquidation = summary.liquidation;
  /**
   * `liquidationPrice`'s label reads "Estimated Liquidation Price," not
   * "Liquidation Price" (06_TASKS.md M9-055 "Audit In-Application
   * Financial Disclosures") — a genuine defect found by that audit: this
   * card and `LiquidationRiskPanel.tsx`'s own "Estimated Liquidation
   * Price" card render the same F-024 figure on the same Dashboard page,
   * and previously disagreed on whether to hedge it as an estimate.
   */
  const liquidationMetrics: Pick<
    DashboardMetrics,
    'liquidationPrice' | 'liquidationDistance' | 'liquidationBuffer'
  > =
    liquidation === null
      ? {
          liquidationPrice: metric('Estimated Liquidation Price', null, 'N/A (no debt)', 'F-024'),
          liquidationDistance: metric('Distance to Liquidation', null, 'N/A (no debt)', 'F-023'),
          liquidationBuffer: metric('Liquidation Buffer', null, 'N/A (no debt)', 'F-025'),
        }
      : {
          liquidationPrice: metric(
            'Estimated Liquidation Price',
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
    engineVersion: summaryResult.metadata.engineVersion,
    formulaVersion: summaryResult.metadata.formulaVersion,
  };
}
