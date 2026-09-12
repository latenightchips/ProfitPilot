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
 * service helper `PortfolioHistoryPanel.tsx` already uses for the
 * identical distance-to-liquidation concept) verbatim.
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
 *
 * **Actionable vs. informational (Safety Targets Semantic/Status Cleanup
 * batch).** The numeric comparator above (`current >= target`) is
 * unchanged and shared by all four fields — this section is about status
 * *label wording* only, via `formatSafetyTargetStatusLabel` below.
 * **Target Health Factor is the only target with an associated
 * Recommendation today** (`services/recommendation/recommendationActions.ts`
 * reads `portfolio.settings.safetyTargets.targetHealthFactor` directly);
 * its "Met"/"Not met" language is unchanged. **Target BTC Price and
 * Holding Period are permanent informational milestones** — reaching
 * either never implies an action (buy/sell/repay/borrow/loop/exit), and
 * neither has, or is intended to gain, an associated Recommendation;
 * `docs/03_UI.md` C-012 "Milestone Card" groups Target BTC Price with
 * "Portfolio Goal"/"Millionaire Target," an upward milestone, never
 * C-013 "Emergency Alert Card" — their labels ("Target reached"/"Below
 * target"/"In progress") reflect that, never "Met"/"Not met". **Safety
 * Buffer is informational in this release, deliberately, not for lack of
 * a deterministic relationship**: `Buffer = 1 − 1/HealthFactor` is an
 * exact algebraic identity between F-022 and F-024 (both already read
 * the same collateral/debt/risk-capacity inputs — see
 * `services/portfolio/summary.ts`'s shared `riskCapacityFraction`), so a
 * target Buffer could in principle drive the same Additional-Collateral/
 * Repayment recommendation Target Health Factor already does. That
 * wiring is intentionally deferred to a separate, explicitly reviewed
 * future batch — this release only changes Buffer's status label
 * ("On target"/"Below target"), not its recommendation behavior, which
 * stays absent.
 *
 * **Safety Buffer ≥100% Persistence-Compatibility batch.** The persisted/
 * hydration schema (`portfolioSafetyTargetsSchema`,
 * `types/portfolio.schema.ts`) deliberately stays permissive (finite,
 * nonnegative, no upper bound) so a legacy portfolio already carrying a
 * finite `safetyBufferPercent >= 100` keeps loading — see the design
 * report this batch implements for why tightening that shared Zod object
 * (read AND write-time, since `portfolioInputSchema`,
 * `portfolioDetailsSchema`, and `persistedPortfolioPayloadSchema` all
 * reference the identical object) would either reject the whole
 * portfolio on load or silently break the Portfolio Settings form's
 * debounced autosave for unrelated field edits. Two independent
 * additions live outside that schema instead: `isValidSafetyBufferTarget`
 * below is the one domain predicate `stores/portfolioStore.ts`'s
 * `create()`/`update()` call to reject a *newly submitted/changed*
 * value of `>= 100` (never applied to a value merely inherited unchanged
 * from an existing portfolio); and the new `'invalid_configuration'`
 * status below is how an *already-persisted* `>= 100` value is honestly
 * represented — never silently shown as `'not_met'`/`'unavailable'`, and
 * never fixed up. No migration, no normalization, no schema change.
 */
import { calculateLiquidationBufferPercent } from '@/services/portfolioHistory';
import type { Portfolio } from '@/types/portfolio';

import type { ServiceResult } from '../shared/result';
import type { PortfolioSummary } from './summary';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SafetyTargetStatus =
  'met' | 'not_met' | 'not_configured' | 'unavailable' | 'invalid_configuration';

export interface SafetyTargetComparison {
  /**
   * `'not_configured'` iff no target is set for this field (the schema's
   * own `optional()` — never treated as `'unavailable'`). `'unavailable'`
   * iff a target IS configured but the current value cannot be computed
   * (a failed `PortfolioSummary`, or — Safety Buffer % only — a
   * zero-debt portfolio with no liquidation risk to measure a buffer
   * against). `'invalid_configuration'` — Safety Buffer % only — iff the
   * configured target itself is `>= 100`, a mathematically unreachable
   * value under the current finite-debt liquidation-buffer definition
   * (`Buffer = 1 − 1/HealthFactor` is always `< 100` for finite nonzero
   * debt); checked *before* current-value availability, so a zero-debt
   * portfolio with a stored target of `150` is `'invalid_configuration'`,
   * not `'unavailable'` — the configuration itself is the problem, not
   * whether a current value happens to be computable. Otherwise `current
   * >= target` decides `'met'`/`'not_met'`.
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

export type SafetyTargetKey =
  'targetHealthFactor' | 'targetBtcPriceUsd' | 'safetyBufferPercent' | 'holdingPeriodDays';

const MET_LABEL: Record<SafetyTargetKey, string> = {
  targetHealthFactor: 'Met',
  safetyBufferPercent: 'On target',
  targetBtcPriceUsd: 'Target reached',
  holdingPeriodDays: 'Target reached',
};

const NOT_MET_LABEL: Record<SafetyTargetKey, string> = {
  targetHealthFactor: 'Not met',
  safetyBufferPercent: 'Below target',
  targetBtcPriceUsd: 'Below target',
  holdingPeriodDays: 'In progress',
};

/** Status label for `'invalid_configuration'` — Safety Buffer % only today; see `SafetyTargetComparison.status`'s own doc comment for the precedence this represents. */
export const INVALID_CONFIGURATION_LABEL = 'Invalid target';

/** Explanation text shown alongside `INVALID_CONFIGURATION_LABEL` on both surfaces (`app/portfolio/SafetyTargetsStatusPanel.tsx`, `features/dashboard/utils/buildSafetyTargetsStatusSummary.ts`) — one shared string so the two can never phrase this differently. */
export const SAFETY_BUFFER_INVALID_TARGET_EXPLANATION =
  'Safety Buffer targets must be below 100%. Update this target in Portfolio Settings.';

/**
 * The one domain predicate for whether a Safety Buffer target value is
 * acceptable to *write* — `0 <= value < 100`. Deliberately not part of
 * `portfolioSafetyTargetsSchema` (see this file's own header comment):
 * this only gates a *newly submitted/changed* value
 * (`stores/portfolioStore.ts`'s `create()`/`update()`), never a value
 * merely inherited unchanged from an existing portfolio, and never the
 * persisted-read path. `Number.isFinite` guards the same non-finite
 * cases the schema's own `.finite()` already rejects at read time, kept
 * here too so this predicate is safe to call standalone (e.g. from a
 * form's own field-level validation) without first re-deriving that
 * schema's rules.
 */
export function isValidSafetyBufferTarget(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value < 100;
}

/**
 * Canonical status-label text for one Safety Target — the single mapping
 * both `app/portfolio/SafetyTargetsStatusPanel.tsx` and
 * `features/dashboard/utils/buildSafetyTargetsStatusSummary.ts` call,
 * replacing each surface's own previously-independent, identical copy of
 * this same switch. Formats `comparison.status` only — the numeric
 * `current >= target` decision itself is entirely `buildSafetyTargetsStatus`'s,
 * unchanged. `unavailableText` stays caller-supplied (never hardcoded
 * here): it depends on `summary.ok`, which is not part of
 * `SafetyTargetComparison`, and already differs correctly by caller
 * (plain "Not available" everywhere except Safety Buffer's zero-debt
 * "No liquidation risk to compare against" case).
 */
export function formatSafetyTargetStatusLabel(
  target: SafetyTargetKey,
  comparison: SafetyTargetComparison,
  unavailableText: string,
): string {
  switch (comparison.status) {
    case 'met':
      return MET_LABEL[target];
    case 'not_met':
      return NOT_MET_LABEL[target];
    case 'not_configured':
      return 'Not configured';
    case 'unavailable':
      return unavailableText;
    case 'invalid_configuration':
      return INVALID_CONFIGURATION_LABEL;
  }
}

function compareAtLeast(target: number | null, current: number | null): SafetyTargetComparison {
  if (target === null) return { status: 'not_configured', target: null, current };
  if (current === null) return { status: 'unavailable', target, current: null };
  return { status: current >= target ? 'met' : 'not_met', target, current };
}

/**
 * Safety Buffer %'s own comparator — `compareAtLeast` plus one
 * precedence check ahead of it: an `>= 100` target is
 * `'invalid_configuration'` regardless of whether `current` is
 * computable, so a zero-debt portfolio with a stored target of `150`
 * reads as an invalid configuration, never merely "unavailable." Not
 * folded into `compareAtLeast` itself — the other three fields have no
 * analogous "the target value itself is out of domain" concept.
 */
function compareSafetyBufferPercent(
  target: number | null,
  current: number | null,
): SafetyTargetComparison {
  if (target !== null && target >= 100) {
    return { status: 'invalid_configuration', target, current };
  }
  return compareAtLeast(target, current);
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
    safetyBufferPercent: compareSafetyBufferPercent(
      targets?.safetyBufferPercent ?? null,
      currentSafetyBufferPercent(portfolio, summary),
    ),
    holdingPeriodDays: compareAtLeast(
      targets?.holdingPeriodDays ?? null,
      elapsedHoldingPeriodDays(portfolio, now),
    ),
  };
}
