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
 * **Only 2 of the 6 documented cases are built — the other 4 remain
 * blocked or structurally unreachable, the same ratio and the same
 * evidence-based discipline `features/dashboard/types/riskWarnings.ts`
 * (M5-010) already established for its own, differently-named 6-item
 * list. Re-derived fresh for Simulation, not assumed identical:**
 *
 * - **"Near liquidation"** — no documented proximity threshold exists
 *   distinct from the disputed Health Factor risk bands Conflict #1
 *   already blocks (re-confirmed by grep across `01_PRD.md`/
 *   `02_Formulas.md`/`04_BUILD_GUIDE.md` before this batch began, not
 *   assumed from Dashboard's own prior finding). The only "near
 *   liquidation"-adjacent check anywhere in this codebase,
 *   `LIQUIDATION_PROXIMITY` (`engine/loop/validateLoopStrategySafety.ts`),
 *   checks `healthFactor <= 1.0` — the liquidation boundary itself, not
 *   a proximity buffer before it — and is scoped to Loop Strategy
 *   inputs, not reusable generically here. Building a "near" threshold
 *   would mean picking a number nothing documents.
 * - **"Invalid assumptions"** — structurally unreachable, not blocked:
 *   `validateScenarioBuilderInput` (`../utils/validateScenarioBuilderInput.ts`,
 *   M6-004) already rejects every invalid field before
 *   `setCurrentScenario`/`runSimulation` is ever called — a negative
 *   BTC price, a percentage change that would zero or invert the price,
 *   a negative Borrow Rate, an invalid Custom Holding Period. A stored
 *   `currentScenario`/`currentResult` can never hold invalid
 *   assumptions, the same "validation gate makes the failure state
 *   unreachable" finding `riskWarnings.ts`'s own "Invalid protocol
 *   parameters" case already established for `Portfolio`.
 * - **"High leverage"** — no numeric leverage threshold exists anywhere
 *   in `01_PRD.md`, `02_Formulas.md`, or `04_BUILD_GUIDE.md` (confirmed
 *   by grep before this batch began) — only the unquantified principle
 *   "Never encourage excessive leverage" (`01_PRD.md`).
 * - **"High borrowing cost"** — the same class of gap
 *   `riskWarnings.ts`'s own "High interest burden" case and conflict
 *   #29 already found: no "acceptable" interest-cost threshold exists
 *   on `Portfolio`/`PortfolioSettings`, and
 *   `RecommendationRuleConfig.loop.maxAcceptableAnnualInterestCost` (the
 *   only place this concept is named anywhere) has no default value
 *   documented.
 *
 * The 2 built cases:
 * - **"Unsafe Health Factor"** — reuses `Portfolio.settings.safetyTargets
 *   ?.targetHealthFactor` (the user's own real, already-configured
 *   per-portfolio value, `buildHealthFactorStatus.ts`'s own field) and
 *   flags when the *simulated* Health Factor falls below it — the exact
 *   same "distance from the user's own target, not an invented absolute
 *   risk band" pattern `riskWarnings.ts`'s own "Health Factor below
 *   configured target" case already established, applied to a simulated
 *   value instead of the live portfolio's own current one. Avoids
 *   Conflict #1 entirely, the same way that precedent does.
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
  item: 'nearLiquidation' | 'invalidAssumptions' | 'highLeverage' | 'highBorrowingCost';
  reason: string;
}
