/**
 * Safety Targets Status — v1.23.0 Batch 1 ("Portfolio Page Safety Targets
 * Status Panel"). Canonical comparison logic, intended to be reused by
 * both the Portfolio page panel (this batch) and, in a later batch, a
 * Dashboard summary — the same "one Service function, two UI consumers"
 * pattern `calculateStartingValueBaselineComparison`
 * (`./startingValueBaseline.ts`) already established for Starting-Value
 * Baseline.
 *
 * **Comparison direction is not invented here.** `docs/03_UI.md`
 * establishes, for every one of the four `PortfolioSafetyTargets`
 * fields, that "met" means the current value has reached or exceeded
 * the configured target:
 * - C-008 "Health Factor Gauge" (Current HF / Target HF) and C-013
 *   "Emergency Alert Card" ("Displayed Only When: HF below target"), plus
 *   the "Auto Loop Engine" section's own stopping condition ("Stop when
 *   Target Health Factor reached" — looping lowers HF, so "reached"
 *   means HF has come down TO the target from above) all establish
 *   Target Health Factor as a floor: safe once current HF >= target.
 * - C-012 "Milestone Card" groups Target BTC Price with "Portfolio Goal"/
 *   "Millionaire Target" — an upward investment milestone, reached once
 *   current price >= target.
 * - C-007 "Progress Bar" explicitly names Holding Period as "progress
 *   toward a target," the same upward-accumulating-goal family as
 *   "Portfolio Goal"/"Target Return" — met once elapsed days >= target.
 * - Safety Buffer % follows the same floor semantics as Target Health
 *   Factor (a minimum protective margin, not a ceiling), consistent with
 *   every other buffer/safety framing in this application and its
 *   listing alongside Target Health Factor in Loop Builder's own
 *   Advanced Options (03_UI.md).
 *
 * All four fields therefore share one comparator: met iff current >=
 * target (inclusive — exact equality counts as met).
 *
 * **Not a new Engine formula.** `targetHealthFactor`/`targetBtcPriceUsd`/
 * `safetyBufferPercent` comparisons read already-computed values
 * (`PortfolioSummary.healthFactor`, `portfolio.market.btcPriceUsd`, and
 * `calculateLiquidationBufferPercent` — the same portfolioHistory
 * service helper `LiquidationBufferTrendSection.tsx` already uses for
 * the identical distance-to-liquidation concept) verbatim.
 * `holdingPeriodDays`'s "current" value is plain calendar arithmetic
 * (elapsed whole days), the same class of computation
 * `features/dashboard/utils/buildDataFreshnessIndicators.ts` already
 * performs for "how long ago was this updated" — not a Formula ID, no
 * new financial interpretation.
 *
 * **Corrected roadmap-audit assumption**: the v1.23.0 roadmap audit that
 * proposed this batch named `portfolio.marketPriceUsd` as "current BTC
 * price." That field is actually the Starting-Value Baseline's own
 * price *at the moment the baseline was established*
 * (`types/portfolio.ts`'s own doc comment: "BTC price (USD) at the
 * moment the baseline was established" — also the field
 * `CsvExporter.ts` reads for its "Baseline BTC Price (USD)" column).
 * The real current price field, confirmed against
 * `CsvExporter.ts`'s own "BTC Price (USD)" column and
 * `startingValueBaseline.ts`'s own "current" computation, is
 * `portfolio.market.btcPriceUsd`. Used here, not the baseline field —
 * a live status panel comparing against a frozen historical snapshot
 * would never update after the baseline was set, defeating the
 * feature's own purpose.
 *
 * **Unit reconciliation, not a new formula**: `safetyBufferPercent` is
 * persisted on a 0–100 scale (`app/portfolio/PortfolioPageClient.tsx`'s
 * own form comment: "stores whatever the user types unconverted"),
 * while `calculateLiquidationBufferPercent` returns a 0–1 fraction (its
 * own header comment). This file multiplies the fraction by 100 before
 * comparing, the same conversion
 * `features/dashboard/utils/format.ts`'s own `formatPercentagePoints`
 * already documents performing in the reverse direction.
 *
 * **Holding Period reference timestamp**: `portfolio.establishedAt`
 * (Starting-Value Baseline, v1.17.0) when a baseline is set, else
 * `portfolio.createdAt` (always present) — both already-persisted
 * timestamps, no new field. Which already-real date counts as "day
 * zero" is a presentation decision, not a financial interpretation.
 */
import { calculateLiquidationBufferPercent } from '@/services/portfolioHistory';
import type { Portfolio } from '@/types/portfolio';

import type { ServiceResult } from '../shared/result';
import type { PortfolioSummary } from './summary';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SafetyTargetStatus = 'met' | 'not_met' | 'not_configured' | 'unavailable';

export interface SafetyTargetComparison {
  /**
   * `'not_configured'` iff no target is set for this field (the schema's
   * own `optional()` — never treated as `'unavailable'`). `'unavailable'`
   * iff a target IS configured but the current value cannot be computed
   * (a failed `PortfolioSummary`, or — Safety Buffer % only — a
   * zero-debt portfolio with no liquidation risk to measure a buffer
   * against). Otherwise `current >= target` decides `'met'`/`'not_met'`.
   */
  status: SafetyTargetStatus;
  /** The configured target, verbatim, or `null` iff not configured. A genuine `0` (valid for `holdingPeriodDays`/`safetyBufferPercent`) is never treated as absent. */
  target: number | null;
  /** The current value, or `null` iff unavailable. Populated even when `target` is `null`, so a viewer can still see the current value with no target configured. */
  current: number | null;
}

export interface SafetyTargetsStatus {
  targetHealthFactor: SafetyTargetComparison;
  targetBtcPriceUsd: SafetyTargetComparison;
  safetyBufferPercent: SafetyTargetComparison;
  holdingPeriodDays: SafetyTargetComparison;
}

function compareAtLeast(target: number | null, current: number | null): SafetyTargetComparison {
  if (target === null) return { status: 'not_configured', target: null, current };
  if (current === null) return { status: 'unavailable', target, current: null };
  return { status: current >= target ? 'met' : 'not_met', target, current };
}

/** `null` iff `summary` failed, or (Safety Buffer % specifically) the portfolio has no debt/liquidation risk to measure a buffer against — never a fabricated value. Converts `calculateLiquidationBufferPercent`'s own 0–1 fraction to the same 0–100 scale `safetyBufferPercent` is persisted in. */
function currentSafetyBufferPercent(
  portfolio: Portfolio,
  summary: ServiceResult<PortfolioSummary>,
): number | null {
  if (!summary.ok) return null;
  const liquidationPriceUsd =
    summary.data.liquidation === null ? null : summary.data.liquidation.price;
  const fraction = calculateLiquidationBufferPercent(
    portfolio.market.btcPriceUsd,
    liquidationPriceUsd,
  );
  return fraction === null ? null : fraction * 100;
}

/** Whole elapsed days since `portfolio.establishedAt` (baseline set) or `portfolio.createdAt` (fallback) — plain calendar arithmetic, never negative (clamped defensively; a real portfolio's reference timestamp is never in the future). */
function elapsedHoldingPeriodDays(portfolio: Portfolio, now: Date): number | null {
  const referenceIso = portfolio.establishedAt ?? portfolio.createdAt;
  const referenceMs = Date.parse(referenceIso);
  if (!Number.isFinite(referenceMs)) return null;
  return Math.max(0, Math.floor((now.getTime() - referenceMs) / MS_PER_DAY));
}

export function buildSafetyTargetsStatus(
  portfolio: Portfolio,
  summary: ServiceResult<PortfolioSummary>,
  now: Date = new Date(),
): SafetyTargetsStatus {
  const targets = portfolio.settings.safetyTargets;

  return {
    targetHealthFactor: compareAtLeast(
      targets?.targetHealthFactor ?? null,
      summary.ok ? summary.data.healthFactor : null,
    ),
    targetBtcPriceUsd: compareAtLeast(
      targets?.targetBtcPriceUsd ?? null,
      portfolio.market.btcPriceUsd,
    ),
    safetyBufferPercent: compareAtLeast(
      targets?.safetyBufferPercent ?? null,
      currentSafetyBufferPercent(portfolio, summary),
    ),
    holdingPeriodDays: compareAtLeast(
      targets?.holdingPeriodDays ?? null,
      elapsedHoldingPeriodDays(portfolio, now),
    ),
  };
}
