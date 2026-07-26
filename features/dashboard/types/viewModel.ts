/**
 * Dashboard View Model types — 06_TASKS.md M5-003 ("Create Dashboard View
 * Model"): "Create a typed view model that converts Portfolio Summary
 * Service results into UI-ready values." Dependencies: M3-005, M5-002.
 * DoD: "Dashboard components consume one stable typed model."
 *
 * Requirements: "Do not calculate financial metrics. Do not mutate
 * Service results." Every value here is read directly off an already-
 * computed `PortfolioSummary` (`services/portfolio/summary.ts`, M3-005) —
 * this module only reshapes and formats, never derives a new number.
 *
 * **"Status classifications" — scoped to avoid Conflict #1, not merged
 * with "Warnings".** 03_UI.md's own Dashboard mockups (`DASHBOARD OBJECTIVES`
 * → `SECTION 1 MARKET SNAPSHOT`, `SECTION 3 HEALTH & RISK`) show a
 * `Portfolio Status` / `Risk Category` field with example values like
 * "Healthy" / "Low" — exactly the Health Factor risk-band classification
 * Conflict #1 blocks (thresholds disagree across four documents; no
 * task-owned resolution exists yet). Rather than invent thresholds here,
 * `DashboardMetric.status` is derived structurally, not from any
 * risk-band rule: `'unavailable'` when the metric's raw value is `null`
 * (currently only the liquidation trio, on a zero-debt portfolio — see
 * PROJECT_STATUS.md conflict #20), `'ok'` otherwise. `DashboardMetric`
 * intentionally has no `'warning'`/`'critical'` status value — M5-003's
 * own "Include" list names "Status classifications" and "Warnings" as two
 * separate items; this reads that literally as two independent
 * mechanisms rather than one field trying to serve both. The full
 * Health Factor risk classification (M5-007's own "Risk classification"
 * Include item) remains blocked on Conflict #1 and is not built here.
 *
 * **`formulaId` values are not invented** — they are the exact Formula
 * IDs `services/portfolio/summary.ts`'s own header comment already
 * documents for each field it computes (F-002, F-003, F-004, F-020,
 * F-011, F-022, F-023, F-024, F-025, F-032). `PortfolioSummary` itself
 * has no per-field Formula ID (only `ServiceMetadata.formulaVersion`,
 * singular, covers the whole call per Conflict #19), so this module
 * carries the same static mapping the Service's own documentation already
 * states, rather than plumbing a new per-field metadata channel through
 * the Service layer — out of scope for a "view model" task.
 */
import type { ApplicationError } from '@/services';
import type { PriceFreshness, PriceOrigin } from '@/services/market';
import type { ProtocolOrigin } from '@/services/protocol';

export type DashboardMetricStatus = 'ok' | 'unavailable';

export interface DashboardMetric {
  label: string;
  rawValue: number | null;
  formattedValue: string;
  status: DashboardMetricStatus;
  /** e.g. "F-022" — see `docs/02_Formulas.md`. `null` when `rawValue` is `null`. */
  formulaId: string | null;
}

export interface DashboardMetrics {
  netPortfolioValue: DashboardMetric;
  totalCollateral: DashboardMetric;
  totalDebt: DashboardMetric;
  healthFactor: DashboardMetric;
  loanToValue: DashboardMetric;
  leverage: DashboardMetric;
  annualInterestCost: DashboardMetric;
  liquidationPrice: DashboardMetric;
  liquidationDistance: DashboardMetric;
  liquidationBuffer: DashboardMetric;
}

export interface DashboardWarning {
  code: string;
  message: string;
}

export interface DashboardMarketFreshness {
  price: number;
  formattedPrice: string;
  origin: PriceOrigin;
  freshness: PriceFreshness;
  updatedAt: string;
  formattedUpdatedAt: string;
}

export interface DashboardProtocolFreshness {
  origin: ProtocolOrigin;
  updatedAt: string;
  formattedUpdatedAt: string;
}

export interface DashboardFreshness {
  /** `null` only in the practically-unreachable `MappingFailure` case — see the builder's own comment. */
  market: DashboardMarketFreshness | null;
  protocol: DashboardProtocolFreshness | null;
}

/**
 * Fields available regardless of whether `calculatePortfolioSummary`
 * succeeded — added in Batch 2 (M5-004, "Implement Dashboard Summary
 * Header"). Identity and price/protocol freshness are read directly off
 * `Portfolio` via `normalizeMarketQuote`/`normalizeProtocolQuote`, never
 * off `PortfolioSummary` — computing them does not depend on the Engine
 * calculation succeeding, so a Summary Header can honestly show "which
 * portfolio and data source are currently active" (M5-004's own DoD)
 * even when the deeper calculation has failed. `DashboardMetrics`/
 * `warnings`/`calculationTimestamp` remain in the `ok`-only branch below,
 * since those genuinely do not exist without a successful calculation.
 */
export interface DashboardViewModelBase {
  portfolioId: string;
  portfolioName: string;
  /** `Portfolio.description` is optional — `null` when unset, never a fabricated placeholder string. */
  portfolioDescription: string | null;
  freshness: DashboardFreshness;
}

export interface DashboardViewModelOk extends DashboardViewModelBase {
  ok: true;
  metrics: DashboardMetrics;
  warnings: DashboardWarning[];
  calculationTimestamp: string;
  formattedCalculationTimestamp: string;
}

export interface DashboardViewModelError extends DashboardViewModelBase {
  ok: false;
  errors: ApplicationError[];
}

/** The one stable typed model every Dashboard component consumes — M5-003's own DoD. */
export type DashboardViewModel = DashboardViewModelOk | DashboardViewModelError;
