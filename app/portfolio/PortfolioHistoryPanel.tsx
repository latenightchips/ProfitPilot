'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';
import {
  calculateLiquidationBufferPercent,
  comparePortfolioHistoryEntries,
  type PortfolioHistoryMetricDelta,
  type PortfolioHistoryNullableMetricDelta,
  type PortfolioHistoryOptionalMetricDelta,
} from '@/services/portfolioHistory';

/**
 * Portfolio History panel — V1.1 Batch 2 ("Portfolio History & Risk
 * Timeline"). Reads persisted `'portfolioHistory'` entries directly via
 * `listPortfolioHistoryForPortfolio` (local component state + effect,
 * the same pattern `SettingsPageClient`'s own Recovery Snapshots section
 * already uses for a persisted list — not Zustand Store state, since
 * this data is never edited in place, only appended to and read).
 * Re-fetches on `portfolio.updatedAt` change, the same dependency
 * `PortfolioPageClient`'s own effects already key on to notice "this
 * portfolio's own record was written again."
 *
 * **Table is the primary, accessible source; the chart is a
 * supplementary visual only** — every number the chart plots is already
 * in the table above it, matching `ScenarioCharts.tsx`'s own established
 * "Accessible alternatives... without replacing numerical data"
 * discipline (`role="img"` + a text `aria-label` summarizing the plotted
 * values, `ResponsiveContainer` for layout, `isAnimationActive={false}`
 * per this codebase's own M9-027 motion-stability rule).
 *
 * **Before/after deltas state a change, never a cause** — each row's
 * delta (vs. the next-older entry) is a plain "X → Y" fact, using
 * `comparePortfolioHistoryEntries`'s own deliberately non-causal output;
 * no wording here implies why a value moved.
 *
 * **Responsive card view below `sm:` (V1.1 Batch 7, Section 4)**: the
 * task's own explicit guidance for this panel — "do not force a wide
 * desktop table into 320px; use responsive cards... preserve timestamp +
 * HF + collateral + debt + meaningful change visibility." The 7-column
 * table already sat in an `overflow-x-auto` wrapper (a real, pre-existing
 * mitigation, not new this batch), but each cell's own delta sub-line
 * (e.g. "$123,456.78 → $130,000.00 (+$6,543.22)") is long enough that
 * scrolling to see later columns is still a real cost at 320–375px — a
 * one-card-per-entry list avoids that scroll entirely by giving every
 * value its own full-width row. Both views render from the same
 * `entries`/`comparePortfolioHistoryEntries` data and the same
 * `format*`/`formatDelta*` helpers below — no separate data path, only a
 * separate layout, one hidden via `sm:hidden` and the other via `hidden
 * sm:block`.
 *
 * **Multi-metric trend chart (V1.3.0 Batch 1, "Portfolio Analytics —
 * Trend Visibility")**: the chart above can now plot Health Factor
 * (unchanged default), Net Worth, Loan-to-Value, or Leverage, switched
 * via a compact `<select>` rather than stacking four permanent charts —
 * see `PORTFOLIO_HISTORY_METRICS` below. The table/card views, their
 * values, and every existing accessibility/motion behavior are
 * unchanged; only the supplementary chart gained a selector. Net Worth
 * is `docs/02_Formulas.md`'s own already-specified "Portfolio Value −
 * Debt" equation applied to a stored snapshot's own `collateral.valueUsd`/
 * `debt.valueUsd` — no new formula. LTV/Leverage read the already-
 * persisted `loanToValue`/`leverage` fields directly, never recomputed.
 *
 * **V1.12.0 Batch 4 ("Portfolio History Data-Source Provenance")** adds a
 * small "Manual"/"Live" badge next to each row's own timestamp, in both
 * the table's "When" cell and the mobile card's header — the same
 * `entry.dataSource: 'manual' | 'live'` field already persisted on every
 * entry (`services/persistence/types/models.ts`'s own header comment:
 * "was any of the data behind this snapshot live-sourced at the time" —
 * a summarizing flag, not a reconstruction of a live portfolio's own
 * four separate provenance fields). Read directly, never inferred from
 * `protocolVersion` or from any current/live state, and never
 * recomputed — the same "display the persisted snapshot exactly"
 * discipline every other field on this page already follows. Reuses the
 * exact `"rounded-full bg-muted px-2 py-0.5"` badge className and
 * `'live'` → `'Live'` / `'manual'` → `'Manual'` label convention already
 * established elsewhere in this app (`utils/protocolStatus.ts`'s own
 * `formatV4ProvenanceStatus`, `app/portfolios/PortfoliosPageClient.tsx`'s
 * own status chips) — no new visual language introduced. Not added as a
 * new chart-selector metric or its own table column: it is categorical,
 * not a numeric trend, and pairing it with the timestamp that already
 * anchors each row avoids widening the already-11-column table or adding
 * a card row, per this batch's own "should not visually dominate"
 * requirement.
 *
 * **V1.13.0 Batch 1 ("Protocol-Version Provenance Badge")** adds a second
 * small badge next to the data-source one above, showing each entry's
 * own persisted `entry.protocolVersion: 'v3' | 'v4'`
 * (`services/persistence/types/models.ts`) — "Aave V3"/"Aave V4", the
 * exact wording already used for user-facing protocol-version
 * identification elsewhere (`AaveProtocolVersionForm.tsx`,
 * `NewPortfolioPageClient.tsx`). A portfolio can switch protocol
 * versions on an existing record (`AaveProtocolVersionForm.tsx`), so its
 * own history can genuinely span both — this badge is what makes each
 * older snapshot's protocol version legible again, rather than only the
 * portfolio's *current* setting. Read directly from the snapshot, the
 * same discipline the data-source badge already established: never
 * inferred from the portfolio's current `protocolVersion`, never
 * recomputed, and both versions treated identically (this file still
 * never branches its own logic on `entry.protocolVersion` — the badge
 * only displays the value, it does not change how any other cell is
 * computed). Reuses the exact same
 * `"rounded-full bg-muted px-2 py-0.5 text-xs font-normal
 * text-muted-foreground"` badge className as the data-source badge,
 * placed immediately before it — categorical, not a chart metric or
 * table column, for the same reason the data-source badge isn't one.
 *
 * **V1.13.0 Batch 2 ("Supply APR Portfolio History Chart Metric")** adds
 * Supply APR, the fourteenth chart-selector metric — the already-persisted
 * `entry.supplyApr` field read directly (no new formula, no
 * recomputation), positioned directly after Borrow APR, the same
 * "adjacent rate metrics" grouping this file's own selector order already
 * follows elsewhere. `entry.supplyApr` is `undefined` for every V4 entry
 * unconditionally — not "not yet synced" the way `borrowApr` can be for a
 * V4 portfolio, but permanently absent, since no V4-facing form or live
 * boundary in this codebase ever produces a V3-shaped supply rate for V4
 * (`resolveSupplyAprDisplay`'s own `'not-applicable'` case,
 * `services/portfolio/mapping.ts`). `formatSupplyApr` renders this as
 * **"Not applicable,"** deliberately distinct from `formatBorrowApr`'s
 * "Not available" — the same distinction
 * `components/strategy/StrategyAssumptionsPanel.tsx` already draws in its
 * own comment for the current-value display of this same field. Like
 * Collateral Quantity and Debt Quantity (v1.12.0 Batches 2–3), this
 * metric is chart-selector only — it does not add a new table column or
 * mobile-card row, matching that same established precedent that not
 * every selectable metric duplicates into the table/card views.
 */
function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

/** `null` means "zero-debt, Health Factor is Infinity" — rendered as "∞", matching `features/dashboard/utils/format.ts`'s own convention for this same value. Also used for `entry.leverage` (V1.1 Batch 4), which is a plain finite `number` per the persisted schema; the `NaN` guard is defensive only. */
function formatHealthFactor(value: number | null): string {
  if (value === null) return '∞';
  if (Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * `entry.dataSource` is always exactly `'manual'` or `'live'` — the
 * persisted contract's own two allowed values
 * (`services/persistence/types/models.ts`), never a third state to
 * guess at. Same short-label convention every other manual/live
 * indicator in this app already uses (`utils/protocolStatus.ts`'s own
 * `formatV4ProvenanceStatus`) — not a new wording invented for this
 * batch.
 */
function formatDataSource(value: 'manual' | 'live'): string {
  return value === 'live' ? 'Live' : 'Manual';
}

/**
 * `entry.protocolVersion` is always exactly `'v3'` or `'v4'` — the
 * persisted contract's own two allowed values
 * (`services/persistence/types/models.ts`), never a third state to
 * guess at. "Aave V3"/"Aave V4" matches the exact wording this app
 * already uses for user-facing protocol-version identification
 * elsewhere (`app/portfolio/AaveProtocolVersionForm.tsx`'s own "Aave
 * V3"/"Aave V4" radio labels, `app/portfolios/new/NewPortfolioPageClient.tsx`'s
 * matching labels) — no new wording invented for this batch.
 */
function formatProtocolVersion(value: 'v3' | 'v4'): string {
  return value === 'v4' ? 'Aave V4' : 'Aave V3';
}

/**
 * `null` means "zero-debt, no liquidation risk" — matching the exact
 * established app-wide convention this same nullable field already uses
 * elsewhere (`features/portfolioApply/components/ApplyToPortfolioReview.tsx`,
 * `features/recommendations/components/RecommendationDetailPanel.tsx`: "No
 * liquidation risk"), **not** the Health-Factor-specific "∞" glyph — a null
 * liquidation price is not "an infinite price," it is the absence of
 * liquidation risk, a distinct concept this formatter states directly
 * rather than borrowing an unrelated convention.
 */
function formatLiquidationPrice(value: number | null): string {
  if (value === null) return 'No liquidation risk';
  return formatCurrency(value);
}

/**
 * `null` means "no liquidation risk" (zero-debt, or an otherwise
 * unavailable denominator — see `calculateLiquidationBufferPercent`'s own
 * comment) — same "No liquidation risk" text as `formatLiquidationPrice`,
 * never a fabricated `0%`. A negative value (market at or below the
 * liquidation price) is rendered as-is, not clamped.
 */
function formatLiquidationBufferPercent(value: number | null): string {
  if (value === null) return 'No liquidation risk';
  return formatPercent(value);
}

/**
 * Collateral BTC quantity — up to 8 fraction digits, matching BTC's own
 * on-chain precision (the same convention
 * `features/dashboard/utils/format.ts`'s own `formatQuantity` already
 * establishes for this project's Dashboard; defined locally here rather
 * than imported, per this file's own established "each page/feature owns
 * its thin formatting layer" convention — see every other `format*`
 * helper above). A literal `" BTC"` suffix disambiguates this metric from
 * every other value on this chart, which are all USD-denominated —
 * required so a quantity is never mistaken for a dollar value.
 */
function formatCollateralQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value)} BTC`;
}

/**
 * Debt native quantity — same 8-fraction-digit convention
 * `formatCollateralQuantity` uses (this project's general asset-quantity
 * precision, not BTC-specific — see `features/dashboard/utils/format.ts`'s
 * own `formatQuantity`). Unlike collateral, the debt asset is not a fixed
 * symbol (`PersistedPortfolioHistoryEntry.debt.asset` is a free `string`,
 * not a literal type) — the repository's own persisted contract does not
 * guarantee it stays "USDC" or any other single symbol, so the unit
 * suffix is read from the entry that produced the value, never
 * hard-coded. `assetSymbol` is optional only so this function type-checks
 * against `PortfolioHistoryMetricConfig.formatValue`'s shared signature
 * (every other metric's own formatter ignores the second parameter); a
 * real call site always has an entry to read it from.
 */
function formatDebtQuantity(value: number, assetSymbol?: string): string {
  if (!Number.isFinite(value)) return '—';
  const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value);
  return assetSymbol ? `${formatted} ${assetSymbol}` : formatted;
}

/**
 * `null` here stands in for `entry.borrowApr === undefined` — "not
 * available" (a V4 portfolio with no synced debt state yet), a distinct
 * concept from "no liquidation risk." Never a fabricated `0%`, never
 * interpolated, never inferred from another field. Matches the exact
 * "Not available" wording this file's own table/card `borrowApr` row
 * already uses.
 */
function formatBorrowApr(value: number | null): string {
  if (value === null) return 'Not available';
  return formatPercent(value);
}

/**
 * `null` here stands in for `entry.supplyApr === undefined`, which is
 * `undefined` for every V4 entry unconditionally
 * (`services/persistence/types/models.ts`'s own doc comment on
 * `supplyApr`, mirroring `resolveSupplyAprDisplay`'s own `'not-applicable'`
 * case) — deliberately **"Not applicable," not "Not available."**
 * `app/portfolio/AaveProtocolVersionForm.tsx`'s sibling,
 * `components/strategy/StrategyAssumptionsPanel.tsx`, already draws this
 * exact distinction explicitly in its own comment: V4 Supply APR "is not
 * a value that could become available later" (unlike a V4 portfolio's
 * Borrow APR before its debt state syncs, which genuinely can), so
 * reusing `formatBorrowApr`'s "Not available" wording here would imply a
 * pending state that does not exist. No V3/V4 semantics are invented by
 * this text — it only gives a user-facing rendering to the same
 * `'not-applicable'` discriminant `SupplyAprDisplay` already names
 * internally. Never a fabricated `0%`, never interpolated, never
 * inferred from `borrowApr` or any other field.
 */
function formatSupplyApr(value: number | null): string {
  if (value === null) return 'Not applicable';
  return formatPercent(value);
}

/**
 * V1.3.0 Batch 1 ("Portfolio Analytics — Trend Visibility") plus V1.4.0
 * Batch 1 ("Annualized Interest Cost Visibility"). Lets the trend chart
 * below plot one of five metrics without permanently stacking five
 * charts — a compact selector switches which of these
 * `getValue`/`formatValue` pairs feeds the same single `LineChart`.
 *
 * **Net Worth is exactly `docs/02_Formulas.md`'s own "Net Worth =
 * Portfolio Value − Debt" equation** (Assets minus Debt), applied to one
 * already-persisted snapshot's own `collateral.valueUsd`/`debt.valueUsd`
 * — no new formula, no Engine involvement, not an alternative
 * definition. Loan-to-Value, Leverage, and Interest Cost (annualized)
 * read the already-persisted `loanToValue`/`leverage`/
 * `annualizedInterestCost` fields directly, the same values the table
 * above already renders — never recomputed here.
 *
 * **"Interest Cost (annualized)" is a point-in-time projection, not a
 * running total.** `entry.annualizedInterestCost` is the projected
 * annual borrowing cost implied by *that one snapshot's own* debt
 * balance and rate — never interest already paid, cumulative interest,
 * realized borrowing cost, or interest paid since inception. Plotting
 * it across snapshots shows how that projection moved over time (e.g. a
 * rate change even with debt held constant); it does not, and must
 * never be read to, sum to a total amount actually paid — the "trend"
 * language `PORTFOLIO_HISTORY_METRICS.label` values feed into the
 * chart's own aria-label summary is the same non-causal, non-cumulative
 * framing this file's own top comment already establishes for every
 * other delta.
 *
 * **V1.5.0 Batch 1 ("Portfolio Analytics — Price & Liquidation Trend
 * Visibility")** adds Market Price and Liquidation Price, bringing the
 * selector to seven metrics. Both read already-persisted fields
 * (`marketPriceUsd`, `liquidationPriceUsd`) directly — no new formula.
 * Liquidation Price reuses `formatLiquidationPrice`'s own "No liquidation
 * risk" convention for a `null` snapshot (zero-debt) rather than the
 * Health-Factor-specific "∞" glyph, or any fabricated numeric price —
 * Recharts skips a `null` data point in the line (the same gap-not-zero
 * behavior Health Factor's own `null` entries already produce), so no
 * interpolation or substitution occurs here either.
 *
 * **V1.6.0 Batch 1 ("Liquidation Buffer Visibility")** adds Liquidation
 * Buffer, an eighth metric that is DISPLAY/SERVICE-LAYER DERIVED, not a
 * new Engine formula or Formula ID: `calculateLiquidationBufferPercent`
 * (`services/portfolioHistory/`) computes `(marketPriceUsd −
 * liquidationPriceUsd) / marketPriceUsd` from the two already-persisted,
 * already-rendered fields v1.5.0 exposed — nothing new is persisted, no
 * Aave adapter is touched, and no Health Factor risk band is implied.
 * `null` (zero-debt / no liquidation risk, or an unavailable denominator)
 * renders as "No liquidation risk," the same text `formatLiquidationPrice`
 * already uses — never a fabricated `0%`. A negative buffer (market at or
 * below the liquidation price) is shown as-is, not clamped.
 *
 * **V1.11.0 Batch 1 ("Borrow APR Trend Completion")** adds Borrow APR, a
 * ninth metric reading the already-persisted `entry.borrowApr` field
 * directly (no new formula, no recomputation) — the same value the table
 * above already renders via its own `entry.borrowApr !== undefined ?
 * formatPercent(entry.borrowApr) : 'Not available'` row. **`undefined`
 * means "not available," a distinct concept from Liquidation
 * Price/Buffer's own `null` ("no liquidation risk")** — `entry.borrowApr`
 * is `undefined` only for a V4 portfolio with no synced debt state yet
 * (`services/persistence/types/models.ts`'s own doc comment), never a
 * fabricated `0%`, never interpolated across surrounding entries, and
 * never inferred from another field. Converted to `null` here only to
 * satisfy `PortfolioHistoryMetricConfig.getValue`'s existing `number |
 * null` return type (the same nullable-chart-point plumbing Liquidation
 * Price/Buffer already use — Recharts skips a `null` point, leaving a
 * gap rather than a fabricated line segment) — `formatValue` renders it
 * as **"Not available,"** not "No liquidation risk," so the distinct
 * reason is never conflated with the liquidation-risk convention.
 *
 * **V1.12.0 Batch 1 ("Collateral Value & Debt Value Portfolio History
 * Chart Parity")** adds Collateral Value and Debt Value, the tenth and
 * eleventh metrics — the same two already-persisted, already-rendered
 * (table/card) fields Net Worth's own `entry.collateral.valueUsd -
 * entry.debt.valueUsd` derivation already reads, now independently
 * selectable rather than only visible as their difference. No new
 * formula, no recomputation from quantity times current price, no
 * live-data or current-market-price substitution — each snapshot's own
 * stored `valueUsd` is plotted exactly as persisted, at record time,
 * identically for V3 and V4 (this file never reads
 * `entry.protocolVersion` for any metric, and these two are no
 * exception). Positioned directly beside `netWorth` in the selector
 * order, the same "raw inputs next to their derived difference"
 * grouping this file's own table already establishes (Collateral Value
 * and Debt Value are adjacent table columns, immediately after Health
 * Factor).
 *
 * **V1.12.0 Batch 2 ("Collateral Quantity Portfolio History Chart
 * Metric")** adds Collateral Quantity, the twelfth metric — the raw
 * `entry.collateral.quantity` (BTC held) each snapshot's own Collateral
 * Value is itself derived from, but never persisted or recomputed here:
 * this metric plots exactly the stored quantity, never `valueUsd`
 * divided by a price, never today's live/current quantity or market
 * data. Positioned directly before `collateralValue` — quantity change
 * (deposit/withdrawal) and value change (price movement) are distinct
 * signals a user may want to tell apart, which is only possible with
 * both plotted independently. `formatCollateralQuantity`'s own `" BTC"`
 * suffix keeps this metric's chart/tooltip/aria-label text unambiguous
 * against every other, USD-denominated metric on the same selector.
 * Identical for V3 and V4 — collateral quantity/value never diverge by
 * protocol version the way debt quantity/value can (see
 * `services/persistence/types/models.ts`'s own doc comment on
 * `collateral`/`debt`), so this metric introduces no protocol-version
 * branching, the same discipline every metric above already follows.
 *
 * **V1.12.0 Batch 3 ("Debt Quantity Portfolio History Chart Metric")**
 * adds Debt Quantity, the thirteenth metric — `entry.debt.quantity`, the
 * single canonical, always-populated field
 * `services/portfolioHistory/buildPortfolioHistoryEntry.ts` already
 * resolves once per protocol version at record time (V3:
 * `portfolio.debt.balance`; V4: `v4DebtState.drawnDebt +
 * v4DebtState.premiumDebt`, or the legacy `0` balance when no V4 debt
 * state has ever synced — never a fabricated non-zero value). This
 * component reads that one already-resolved number directly and
 * introduces no protocol-version branching of its own — the producer,
 * not this presentation layer, is where V3/V4 isolation is already
 * enforced (see that file's own header comment). Unlike Collateral
 * Quantity, the debt asset symbol is not a fixed literal
 * (`PersistedPortfolioHistoryEntry.debt.asset` is a free `string`), so
 * `formatDebtQuantity` reads each point's own `entry.debt.asset` rather
 * than hard-coding one — `PortfolioHistoryMetricConfig.formatValue` gains
 * an optional second `entry` parameter for exactly this (every other
 * metric's own formatter ignores it, unchanged). Positioned directly
 * before `debtValue`, the same "quantity beside its own value" grouping
 * `collateralQuantity`/`collateralValue` already established.
 */
type PortfolioHistoryMetricKey =
  | 'healthFactor'
  | 'collateralQuantity'
  | 'collateralValue'
  | 'debtQuantity'
  | 'debtValue'
  | 'netWorth'
  | 'loanToValue'
  | 'leverage'
  | 'borrowApr'
  | 'supplyApr'
  | 'annualizedInterestCost'
  | 'marketPrice'
  | 'liquidationPrice'
  | 'liquidationBufferPercent';

interface PortfolioHistoryMetricConfig {
  label: string;
  getValue: (entry: PersistedPortfolioHistoryEntry) => number | null;
  /**
   * `entry` is optional and unused by every metric except Debt Quantity
   * (v1.12.0 Batch 3), which needs it to read that point's own
   * `debt.asset` symbol — a backward-compatible signature widening, not a
   * behavior change for any existing metric.
   */
  formatValue: (value: number | null, entry?: PersistedPortfolioHistoryEntry) => string;
}

const PORTFOLIO_HISTORY_METRICS: Record<PortfolioHistoryMetricKey, PortfolioHistoryMetricConfig> = {
  healthFactor: {
    label: 'Health Factor',
    getValue: (entry) => entry.healthFactor,
    formatValue: (value) => formatHealthFactor(value),
  },
  collateralQuantity: {
    label: 'Collateral Quantity',
    getValue: (entry) => entry.collateral.quantity,
    formatValue: (value) => (value === null ? '—' : formatCollateralQuantity(value)),
  },
  collateralValue: {
    label: 'Collateral Value',
    getValue: (entry) => entry.collateral.valueUsd,
    formatValue: (value) => (value === null ? '—' : formatCurrency(value)),
  },
  debtQuantity: {
    label: 'Debt Quantity',
    getValue: (entry) => entry.debt.quantity,
    formatValue: (value, entry) =>
      value === null ? '—' : formatDebtQuantity(value, entry?.debt.asset),
  },
  debtValue: {
    label: 'Debt Value',
    getValue: (entry) => entry.debt.valueUsd,
    formatValue: (value) => (value === null ? '—' : formatCurrency(value)),
  },
  netWorth: {
    label: 'Net Worth',
    getValue: (entry) => entry.collateral.valueUsd - entry.debt.valueUsd,
    formatValue: (value) => (value === null ? '—' : formatCurrency(value)),
  },
  loanToValue: {
    label: 'Loan-to-Value',
    getValue: (entry) => entry.loanToValue,
    formatValue: (value) => (value === null ? '—' : formatPercent(value)),
  },
  leverage: {
    label: 'Leverage',
    getValue: (entry) => entry.leverage,
    formatValue: (value) => (value === null ? '—' : `${formatHealthFactor(value)}x`),
  },
  borrowApr: {
    label: 'Borrow APR',
    getValue: (entry) => entry.borrowApr ?? null,
    formatValue: (value) => formatBorrowApr(value),
  },
  supplyApr: {
    label: 'Supply APR',
    getValue: (entry) => entry.supplyApr ?? null,
    formatValue: (value) => formatSupplyApr(value),
  },
  annualizedInterestCost: {
    label: 'Interest Cost (annualized)',
    getValue: (entry) => entry.annualizedInterestCost,
    formatValue: (value) => (value === null ? '—' : formatCurrency(value)),
  },
  marketPrice: {
    label: 'Market Price',
    getValue: (entry) => entry.marketPriceUsd,
    formatValue: (value) => (value === null ? '—' : formatCurrency(value)),
  },
  liquidationPrice: {
    label: 'Liquidation Price',
    getValue: (entry) => entry.liquidationPriceUsd,
    formatValue: (value) => formatLiquidationPrice(value),
  },
  liquidationBufferPercent: {
    label: 'Liquidation Buffer',
    getValue: (entry) =>
      calculateLiquidationBufferPercent(entry.marketPriceUsd, entry.liquidationPriceUsd),
    formatValue: (value) => formatLiquidationBufferPercent(value),
  },
};

/** Selector order, matching the order the task's own required list names them. */
const PORTFOLIO_HISTORY_METRIC_ORDER: PortfolioHistoryMetricKey[] = [
  'healthFactor',
  'collateralQuantity',
  'collateralValue',
  'debtQuantity',
  'debtValue',
  'netWorth',
  'loanToValue',
  'leverage',
  'borrowApr',
  'supplyApr',
  'annualizedInterestCost',
  'marketPrice',
  'liquidationPrice',
  'liquidationBufferPercent',
];

/**
 * Concise, user-facing disambiguation for `title` attributes on the
 * "Interest Cost (annualized)" table header and card label — per this
 * batch's own explicit semantic requirement: this figure must never be
 * read as interest already paid, cumulative interest, realized
 * borrowing cost, or interest paid since inception.
 */
const ANNUALIZED_INTEREST_COST_TOOLTIP =
  "Projected annualized borrowing cost at this snapshot's own debt and rate — not interest already paid or a running total.";

/**
 * Concise, user-facing disambiguation for the "Liquidation Buffer" table
 * header and card label — per this batch's own explicit requirement that
 * the label make clear this is a percentage distance between this
 * snapshot's own market price and estimated liquidation price, not a
 * Health Factor risk classification.
 */
const LIQUIDATION_BUFFER_TOOLTIP =
  "Percentage distance between this snapshot's own market price and estimated liquidation price — not a Health Factor risk classification.";

function formatDelta(
  delta: PortfolioHistoryMetricDelta,
  format: (value: number) => string,
): string {
  if (!delta.changed) return '—';
  const sign = delta.delta > 0 ? '+' : '';
  return `${format(delta.before)} → ${format(delta.after)} (${sign}${format(delta.delta)})`;
}

/**
 * `nullLabel` defaults to '∞' — Health Factor's own existing, unchanged
 * convention — so every pre-V1.5.0 call site keeps its exact prior
 * behavior. Liquidation Price passes `'No liquidation risk'` instead
 * (see `formatLiquidationPrice`'s own comment for why "∞" would be
 * wrong there).
 */
function formatNullableDelta(
  delta: PortfolioHistoryNullableMetricDelta,
  format: (value: number) => string,
  nullLabel: string = '∞',
): string {
  if (!delta.changed) return '—';
  const beforeText = delta.before === null ? nullLabel : format(delta.before);
  const afterText = delta.after === null ? nullLabel : format(delta.after);
  if (delta.before === null || delta.after === null) {
    return `${beforeText} → ${afterText}`;
  }
  const sign = (delta.delta ?? 0) > 0 ? '+' : '';
  return `${beforeText} → ${afterText} (${sign}${format(delta.delta ?? 0)})`;
}

function formatOptionalDelta(
  delta: PortfolioHistoryOptionalMetricDelta,
  format: (value: number) => string,
): string {
  if (!delta.changed) return '—';
  if (delta.before === undefined || delta.after === undefined) {
    // Availability itself changed (e.g. now derivable, previously wasn't)
    // — a fact worth stating plainly, not a numeric delta to compute.
    return `${delta.before !== undefined ? format(delta.before) : 'Not available'} → ${
      delta.after !== undefined ? format(delta.after) : 'Not available'
    }`;
  }
  const sign = (delta.delta ?? 0) > 0 ? '+' : '';
  return `${format(delta.before)} → ${format(delta.after)} (${sign}${format(delta.delta ?? 0)})`;
}

function HistoryEntryCard({
  entry,
  delta,
}: {
  entry: PersistedPortfolioHistoryEntry;
  delta: ReturnType<typeof comparePortfolioHistoryEntries> | null;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-3 text-xs">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <span>{formatTimestamp(entry.createdAt)}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {formatProtocolVersion(entry.protocolVersion)}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {formatDataSource(entry.dataSource)}
        </span>
      </p>
      <dl className="flex flex-col gap-1.5">
        {(
          [
            {
              label: 'Health Factor',
              value: formatHealthFactor(entry.healthFactor),
              delta:
                delta !== null ? formatNullableDelta(delta.healthFactor, formatHealthFactor) : null,
            },
            {
              label: 'Collateral Value',
              value: formatCurrency(entry.collateral.valueUsd),
              delta: delta !== null ? formatDelta(delta.collateralValueUsd, formatCurrency) : null,
            },
            {
              label: 'Debt Value',
              value: formatCurrency(entry.debt.valueUsd),
              delta: delta !== null ? formatDelta(delta.debtValueUsd, formatCurrency) : null,
            },
            {
              label: 'LTV',
              value: formatPercent(entry.loanToValue),
              delta: delta !== null ? formatDelta(delta.loanToValue, formatPercent) : null,
            },
            {
              label: 'Leverage',
              value: `${formatHealthFactor(entry.leverage)}x`,
              delta:
                delta !== null
                  ? formatDelta(delta.leverage, (v) => `${formatHealthFactor(v)}x`)
                  : null,
            },
            {
              label: 'Borrow APR',
              value:
                entry.borrowApr !== undefined ? formatPercent(entry.borrowApr) : 'Not available',
              delta: delta !== null ? formatOptionalDelta(delta.borrowApr, formatPercent) : null,
            },
            {
              label: 'Interest Cost (annualized)',
              value: formatCurrency(entry.annualizedInterestCost),
              delta:
                delta !== null ? formatDelta(delta.annualizedInterestCost, formatCurrency) : null,
            },
            {
              label: 'Market Price',
              value: formatCurrency(entry.marketPriceUsd),
              delta: delta !== null ? formatDelta(delta.marketPriceUsd, formatCurrency) : null,
            },
            {
              label: 'Liquidation Price',
              value: formatLiquidationPrice(entry.liquidationPriceUsd),
              delta:
                delta !== null
                  ? formatNullableDelta(
                      delta.liquidationPriceUsd,
                      formatCurrency,
                      'No liquidation risk',
                    )
                  : null,
            },
            {
              label: 'Liquidation Buffer',
              value: formatLiquidationBufferPercent(
                calculateLiquidationBufferPercent(entry.marketPriceUsd, entry.liquidationPriceUsd),
              ),
              delta:
                delta !== null
                  ? formatNullableDelta(
                      delta.liquidationBufferPercent,
                      formatPercent,
                      'No liquidation risk',
                    )
                  : null,
            },
          ] as const
        ).map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt
                className="text-muted-foreground"
                title={
                  row.label === 'Interest Cost (annualized)'
                    ? ANNUALIZED_INTEREST_COST_TOOLTIP
                    : row.label === 'Liquidation Buffer'
                      ? LIQUIDATION_BUFFER_TOOLTIP
                      : undefined
                }
              >
                {row.label}
              </dt>
              <dd className="text-right text-foreground">{row.value}</dd>
            </div>
            {row.delta !== null && row.delta !== '—' && (
              <p className="text-right text-muted-foreground">{row.delta}</p>
            )}
          </div>
        ))}
      </dl>
    </li>
  );
}

export function PortfolioHistoryPanel({
  portfolioId,
  portfolioUpdatedAt,
}: {
  portfolioId: string;
  portfolioUpdatedAt: string;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [entries, setEntries] = useState<PersistedPortfolioHistoryEntry[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<PortfolioHistoryMetricKey>('healthFactor');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    void listPortfolioHistoryForPortfolio(portfolioId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setStatus('error');
        return;
      }
      // `listPortfolioHistoryForPortfolio` returns most-recent-first —
      // kept as-is for the table (a changelog reads newest-on-top);
      // the chart below reverses it for a left-to-right chronological line.
      setEntries(result.data.map((envelope) => envelope.payload));
      setStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [portfolioId, portfolioUpdatedAt]);

  if (status === 'loading') {
    return (
      <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-3">
        <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
          History
        </h2>
        {/* No `role="status"` here — `PortfolioPageClient`'s own save-status
            region already owns that role on this page (M4-013); a second
            `role="status"` element would make any `getByRole('status')`
            query on the page ambiguous. This loading state is brief and
            panel-local, not the page's primary live-region announcement. */}
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-3">
        <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
          History
        </h2>
        <p className="text-xs text-destructive" role="alert">
          History could not be loaded.
        </p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-3">
        <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
          History
        </h2>
        <p className="text-xs text-muted-foreground">
          No history yet. A snapshot is recorded automatically when you create or update this
          portfolio, or accept live Aave data that differs meaningfully from what you last saved.
        </p>
      </section>
    );
  }

  const selectedMetricConfig = PORTFOLIO_HISTORY_METRICS[selectedMetric];
  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatTimestamp(entry.createdAt),
    value: selectedMetricConfig.getValue(entry),
    entry,
  }));
  const chartSummary = `${selectedMetricConfig.label} trend: ${chartData
    .map(
      (point) => `${point.timestamp} ${selectedMetricConfig.formatValue(point.value, point.entry)}`,
    )
    .join(', ')}`;

  return (
    <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-4">
      <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
        History
      </h2>

      {entries.length >= 2 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            <label
              htmlFor="portfolio-history-metric-select"
              className="text-xs text-muted-foreground"
            >
              Chart metric
            </label>
            <select
              id="portfolio-history-metric-select"
              value={selectedMetric}
              onChange={(event) =>
                setSelectedMetric(event.target.value as PortfolioHistoryMetricKey)
              }
              className="rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground"
            >
              {PORTFOLIO_HISTORY_METRIC_ORDER.map((key) => (
                <option key={key} value={key}>
                  {PORTFOLIO_HISTORY_METRICS[key].label}
                </option>
              ))}
            </select>
          </div>
          <div
            role="img"
            aria-label={chartSummary}
            className="h-40 w-full rounded-md border border-border p-2"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis
                  width={
                    selectedMetric === 'collateralQuantity' || selectedMetric === 'debtQuantity'
                      ? 72
                      : selectedMetric === 'collateralValue' ||
                          selectedMetric === 'debtValue' ||
                          selectedMetric === 'netWorth' ||
                          selectedMetric === 'annualizedInterestCost' ||
                          selectedMetric === 'marketPrice' ||
                          selectedMetric === 'liquidationPrice'
                        ? 56
                        : 32
                  }
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value: number) =>
                    // Recharts hands the axis formatter only the raw tick
                    // value, never the originating entry — a single
                    // representative entry (the most recent) is used only
                    // for this compact scale label; the fully accurate,
                    // per-point debt asset symbol is what the accessible
                    // `chartSummary` aria-label above actually states.
                    selectedMetricConfig.formatValue(value, entries[0])
                  }
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-foreground, currentColor)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-3 sm:hidden">
        {entries.map((entry, index) => {
          const olderEntry = entries[index + 1];
          const delta =
            olderEntry !== undefined ? comparePortfolioHistoryEntries(olderEntry, entry) : null;
          return (
            <HistoryEntryCard key={`${entry.createdAt}-${index}`} entry={entry} delta={delta} />
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                When
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Health Factor
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Collateral Value
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Debt Value
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                LTV
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Leverage
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Borrow APR
              </th>
              <th
                scope="col"
                className="py-1.5 pr-3 font-medium"
                title={ANNUALIZED_INTEREST_COST_TOOLTIP}
              >
                Interest Cost (annualized)
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Market Price
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Liquidation Price
              </th>
              <th scope="col" className="py-1.5 font-medium" title={LIQUIDATION_BUFFER_TOOLTIP}>
                Liquidation Buffer
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const olderEntry = entries[index + 1];
              const delta =
                olderEntry !== undefined ? comparePortfolioHistoryEntries(olderEntry, entry) : null;
              return (
                <tr key={`${entry.createdAt}-${index}`} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 text-foreground">
                    <div className="flex items-center gap-2">
                      <span>{formatTimestamp(entry.createdAt)}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {formatProtocolVersion(entry.protocolVersion)}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {formatDataSource(entry.dataSource)}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{formatHealthFactor(entry.healthFactor)}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatNullableDelta(delta.healthFactor, formatHealthFactor)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">
                      {formatCurrency(entry.collateral.valueUsd)}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.collateralValueUsd, formatCurrency)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{formatCurrency(entry.debt.valueUsd)}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.debtValueUsd, formatCurrency)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{formatPercent(entry.loanToValue)}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.loanToValue, formatPercent)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{`${formatHealthFactor(entry.leverage)}x`}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.leverage, (v) => `${formatHealthFactor(v)}x`)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">
                      {entry.borrowApr !== undefined
                        ? formatPercent(entry.borrowApr)
                        : 'Not available'}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatOptionalDelta(delta.borrowApr, formatPercent)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">
                      {formatCurrency(entry.annualizedInterestCost)}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.annualizedInterestCost, formatCurrency)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{formatCurrency(entry.marketPriceUsd)}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.marketPriceUsd, formatCurrency)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">
                      {formatLiquidationPrice(entry.liquidationPriceUsd)}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatNullableDelta(
                          delta.liquidationPriceUsd,
                          formatCurrency,
                          'No liquidation risk',
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5">
                    <div className="text-foreground">
                      {formatLiquidationBufferPercent(
                        calculateLiquidationBufferPercent(
                          entry.marketPriceUsd,
                          entry.liquidationPriceUsd,
                        ),
                      )}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatNullableDelta(
                          delta.liquidationBufferPercent,
                          formatPercent,
                          'No liquidation risk',
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
