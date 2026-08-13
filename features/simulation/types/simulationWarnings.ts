/**
 * Simulation Warning types — 06_TASKS.md M6-014 ("Implement Simulation
 * Warnings"). Dependencies: M6-009. Priority P0, Effort M. Description:
 * "Display warnings for Unsafe Health Factor, Near liquidation, Stale
 * prices, Invalid assumptions, High leverage, High borrowing cost" (6
 * items). DoD: "Warnings explain both the cause and potential impact" —
 * `reason`/`potentialImpact` below are named directly from that literal
 * wording (deliberately not `recommendedAction`, the field name
 * `features/dashboard/types/riskWarnings.ts`'s own `RiskWarning` uses for
 * M5-010's own, differently-worded DoD).
 *
 * **5 of the 6 originally-documented cases are now built.** M6-014's own
 * Description named "Near liquidation," "High leverage," and "High
 * borrowing cost" as blocked at the time this file was first written,
 * since no document defined a numeric threshold for any of them — only
 * "Invalid assumptions" remains structurally unreachable (see below).
 * The thresholds below were explicitly requested and approved (not
 * derived from `01_PRD.md`/`02_Formulas.md`/`04_BUILD_GUIDE.md`, none of
 * which define one) as part of a later, dedicated "Simulation warning
 * thresholds" task — reported with reasoning and confirmed before this
 * file was changed, the same "propose and confirm before committing"
 * process every other undocumented-number decision in this codebase has
 * followed. Warnings remain purely informational: none of the added
 * checks feed back into `simulateScenario`/`simulatePortfolioAction` or
 * change any calculated result.
 *
 * - **"Invalid assumptions"** — still structurally unreachable, not
 *   blocked: `validateScenarioBuilderInput` (`../utils/validateScenarioBuilderInput.ts`,
 *   M6-004) already rejects every invalid field before
 *   `setCurrentScenario`/`runSimulation` is ever called — a negative
 *   BTC price, a percentage change that would zero or invert the price,
 *   a negative Borrow Rate, an invalid Custom Holding Period. A stored
 *   `currentScenario`/`currentResult` can never hold invalid
 *   assumptions, the same "validation gate makes the failure state
 *   unreachable" finding `riskWarnings.ts`'s own "Invalid protocol
 *   parameters" case already established for `Portfolio`.
 *
 * The 7 built cases:
 * - **"Unsafe Health Factor"** — reuses `Portfolio.settings.safetyTargets
 *   ?.targetHealthFactor` (the user's own real, already-configured
 *   per-portfolio value, `buildHealthFactorStatus.ts`'s own field) and
 *   flags when the *simulated* Health Factor falls below it — the exact
 *   same "distance from the user's own target, not an invented absolute
 *   risk band" pattern `riskWarnings.ts`'s own "Health Factor below
 *   configured target" case already established, applied to a simulated
 *   value instead of the live portfolio's own current one. Avoids
 *   Conflict #1 entirely, the same way that precedent does. A
 *   *personalized* threshold — distinct from the two fixed, universal
 *   checks below, which fire regardless of the user's own target.
 * - **"Near liquidation"** (`NEAR_LIQUIDATION`) — fires for
 *   `1.0 < healthFactor <= 1.1`. Health Factor 1.0 is the exact,
 *   formula-defined liquidation boundary (`collateralValue ×
 *   liquidationThreshold === debtValue`); a 10% buffer above that is the
 *   chosen "getting close" cushion — a round, conservative margin, not a
 *   documented one (Conflict #1's own disputed general-purpose risk
 *   bands are still not being invented here; this is a single, narrow,
 *   liquidation-specific proximity check, the same scope
 *   `LIQUIDATION_PROXIMITY`, below, already has for Loop Strategy).
 * - **"Health Factor at or below liquidation"** (`AT_LIQUIDATION`) —
 *   fires for `healthFactor <= 1.0`. Not invented: the same fixed
 *   mathematical boundary `LIQUIDATION_PROXIMITY`
 *   (`engine/loop/validateLoopStrategySafety.ts`) already checks for
 *   Loop Strategy inputs, applied here to a simulated Health Factor
 *   instead. Distinct from "Unsafe Health Factor" above (a personalized
 *   target) and from "Near liquidation" (still short of the boundary).
 * - **"Negative equity"** (`NEGATIVE_EQUITY`) — fires for `equity < 0`.
 *   Reuses the exact same code the Formula Engine itself already emits
 *   for this concept (`calculateNetWorth`/`calculateEffectiveLeverage`,
 *   both `engine/portfolio/`) — that Engine-level warning already
 *   surfaces today through `state.warnings` in `ScenarioSummary.tsx`'s
 *   own generic "Warnings" subsection whenever it occurs, but as a raw,
 *   uncurated Engine message with no `potentialImpact` explanation. This
 *   case exists here too so the dedicated Simulation Warnings section
 *   (this file's own consumer) also explains it consistently with every
 *   other case here, not to duplicate detection logic — both read the
 *   same already-computed simulated equity value.
 * - **"High leverage"** (`HIGH_LEVERAGE`) — fires for `leverage >= 3`.
 *   No numeric leverage threshold exists anywhere in the specification
 *   (only the unquantified principle "Never encourage excessive
 *   leverage," `01_PRD.md`) — 3x was chosen as a round, moderately
 *   conservative line roughly between the Loop Builder's own "Balanced"
 *   and "Aggressive" presets (`LoopPresets.tsx`, `minHealthFactor` 1.8
 *   and 1.5 respectively), not derived from either.
 * - **"High borrowing cost"** (`HIGH_BORROWING_COST`) — fires for
 *   `borrowApr >= 0.15` (15%). No "acceptable" interest-cost threshold
 *   exists anywhere in the specification, and
 *   `RecommendationRuleConfig.loop.maxAcceptableAnnualInterestCost` (the
 *   only place this concept is named anywhere) has no default value
 *   documented — 15% was chosen as a round rate roughly 3x the 5% used
 *   throughout this codebase's own fixtures/defaults as an ordinary
 *   Borrow APR, comfortably above typical variable-rate ranges.
 * - **"Long holding-period assumption"** (`LONG_HOLDING_PERIOD`) — fires
 *   for an active interest scenario's own `timeHorizonDays > 365`. Not
 *   part of M6-014's original 6-item list — requested directly as part
 *   of the same later task that supplied the thresholds above. Never
 *   fires for any of the Holding Period `<select>`'s own 4 built-in
 *   presets (30/90/180/365 days, `ScenarioBuilder.tsx`'s own
 *   `HOLDING_PERIOD_OPTIONS`) — only for a deliberately-entered Custom
 *   Holding Period longer than the longest built-in preset, where the
 *   simple (non-compounding) prorated-interest projection this
 *   engagement's own formulas already use becomes a much rougher
 *   approximation of real-world compounding cost, and the "rate/price
 *   held fixed" assumption itself becomes least realistic.
 * - **"Stale prices"** — reuses `normalizeMarketQuote`
 *   (`services/market/quote.ts`, M3-007) against `Portfolio.marketUpdatedAt`
 *   — the real, documented "stale after 5 minutes" rule
 *   (`04_BUILD_GUIDE.md` "PRICE FRESHNESS"), not an invented threshold.
 *   Reflects the *baseline portfolio's* own price data quality, since a
 *   price/interest scenario's own overridden price has no independent
 *   "freshness" concept of its own to check.
 */
export interface SimulationWarning {
  code: string;
  reason: string;
  potentialImpact: string;
}

export interface UnavailableSimulationWarning {
  item: 'invalidAssumptions';
  reason: string;
}
