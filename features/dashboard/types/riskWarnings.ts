/**
 * Risk Warning types — 06_TASKS.md M5-010 ("Implement Risk Warning
 * Banner"). Dependencies: M5-007, M5-009. DoD: "Each warning includes a
 * reason and recommended next action."
 *
 * **Only 3 of the 6 documented "Warning cases" are built — the other 3
 * remain blocked, not silently dropped:**
 * - **"Health Factor near liquidation"** — no documented proximity
 *   threshold exists distinct from the risk-band boundaries Conflict #1
 *   already blocks. The only "near liquidation"-adjacent check anywhere
 *   in this codebase, `LIQUIDATION_PROXIMITY`
 *   (`engine/loop/validateLoopStrategySafety.ts`), actually checks
 *   `healthFactor <= 1.0` — the liquidation boundary itself, not a
 *   proximity buffer before it — and is scoped to Loop Strategy inputs
 *   (`minHealthFactor`, `targetBorrowPercentage`, `maxLoops`), not
 *   reusable generically for a Dashboard-level check. Building a "near"
 *   threshold here would mean picking a number nothing documents.
 * - **"Invalid protocol parameters"** — structurally unreachable, not
 *   blocked: `types/portfolio.schema.ts`'s `.refine()` cross-field check
 *   (`maxLoanToValue <= liquidationThreshold`) runs on every `create`
 *   and `update` (`stores/portfolioStore.ts` re-validates the fully
 *   merged portfolio on every mutation), so a stored `Portfolio` can
 *   never have invalid protocol parameters. Nothing to warn about, ever.
 * - **"High interest burden"** — the same class of gap as conflict #29
 *   (Batch 4): no "acceptable" interest-cost threshold exists on
 *   `Portfolio`/`PortfolioSettings`, and `RecommendationRuleConfig.loop.
 *   maxAcceptableAnnualInterestCost` (the only place this concept is
 *   documented) has no default value anywhere in the specification.
 *
 * The 3 built cases:
 * - "Health Factor below configured target" — `HealthFactorStatus`
 *   (M5-007, Batch 4) already computes `distanceFromTarget`; a negative
 *   value is exactly this condition, using the portfolio's own real
 *   configured target, not an invented threshold.
 * - "Missing or stale price data" — `DashboardFreshness.market`
 *   (M5-003/M5-004) already carries `freshness: 'fresh' | 'stale'` or is
 *   `null` when unavailable.
 * - "Calculation warnings" — `DashboardViewModelOk.warnings` (M5-003),
 *   already real `ServiceWarning`s from `calculatePortfolioSummary`.
 */
export interface RiskWarning {
  code: string;
  reason: string;
  recommendedAction: string;
}
