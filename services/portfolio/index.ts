/**
 * Portfolio Service — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory. M3-004 ("Implement Portfolio Mapping Utilities") was its
 * first occupant; M3-005 ("Implement Portfolio Summary Service") and
 * M3-006 ("Implement Portfolio Action Preview Service") are its second,
 * implemented together as one cohesive unit — M3-006 is
 * `calculatePortfolioSummary` called twice around a pure portfolio
 * transformation, not an independent calculation.
 * `calculateDebtInterestBreakdown` was added in Milestone 5 Batch 6 to
 * support M5-013's Monthly/Daily interest cost Display items — see that
 * file's own header comment. `calculatePortfolioExposure` was added in
 * Milestone 7 Batch 2 to support M7-011's "BTC exposure" Display item
 * for the current (pre-strategy) portfolio state — see that file's own
 * header comment.
 *
 * **`AaveProtocolVersion`/`AaveV4PositionIdentity` (V4 Readiness Audit
 * §12 Stage 5)** — re-exported here, not previously part of this barrel,
 * because `stores/portfolioStore.ts` is now their first Store-layer
 * consumer (`setProtocolVersion`/`setAaveV4Position`) and Stores only
 * import from this public entry point, never by reaching into
 * `./models.ts` or `@/engine` directly — the same boundary
 * `types/portfolio.ts`'s own `Portfolio extends ApplicationPortfolio`
 * already respects. Both are re-exports of Stage 1's/Stage 4A's existing
 * types, not new models. `AaveV4DebtState` (Stage 6) joins them for the
 * same reason: `setAaveV4DebtState` is its first Store-layer consumer.
 *
 * **`checkAaveV4DebtStateAvailable`/`deriveV4DebtStateAfterDelta` (V4
 * Readiness Audit §12 Stage 13)** — re-exported so
 * `app/portfolio/PortfolioPageClient.tsx`'s `DebtPositionForm` can compute
 * a real, protocol-backed V4 repayment preview directly (the same
 * "call a Service function straight from a UI component's Preview
 * handler" pattern this file's own `calculatePortfolioSummary` already
 * uses there), rather than the UI reimplementing Stage 11/12's
 * premium-first repayment-allocation logic a second time.
 *
 * **`deriveAaveV4EffectiveBorrowRate` (V4 Readiness Audit §12 Stage 15)**
 * — re-exported for the same reason: every consumer that previously read
 * the legacy `protocol.borrowApr` scalar for a V4 portfolio
 * (`buildDebtAndInterestPanel`/`buildPortfolioComposition` on the
 * Dashboard, `PortfolioPageClient`'s Debt form, `services/loop/strategy.ts`,
 * `services/recommendation/recommendations.ts`) now calls this instead.
 *
 * **`resolveCanonicalDebtBalance` (V4 Readiness Audit §12 Stage 16)** —
 * re-exported for the same reason again: every remaining consumer that
 * read the legacy `debt.balance` scalar directly for "the portfolio's
 * current total debt" (`DebtPositionForm`'s edit delta,
 * `exitPlannerStore`'s partial-repayment target,
 * `ApplyLoopAsSimulation`'s simulation delta, Scenario Builder
 * validation, the Portfolios list "No debt" badge, the Dashboard's debt
 * quantity, CSV/exit-plan export) now calls this instead.
 *
 * **`AaveV4CollateralRiskConfig` (V4 Readiness Audit §12 Stage 23C)** —
 * joins `AaveV4DebtState` for the same reason: `setAaveV4CollateralRisk`
 * (`stores/portfolioStore.ts`) is its first Store-layer consumer. Not yet
 * read by any calculation Service — see that type's own doc comment
 * (`./models.ts`) for why that dispatch is explicitly deferred to Stage
 * 23D.
 */
export {
  type PortfolioAction,
  type PortfolioActionPreview,
  previewPortfolioAction,
} from './actionPreview';
export { calculatePortfolioExposure } from './exposure';
export { calculateDebtInterestBreakdown, type DebtInterestBreakdown } from './interestBreakdown';
export {
  checkAaveV4DebtStateAvailable,
  deriveAaveV4EffectiveBorrowRate,
  deriveV4DebtStateAfterDelta,
  mapApplicationPortfolioToEngineInput,
  mapPersistencePortfolioToApplicationPortfolio,
  type MappingFailure,
  type MappingResult,
  type MappingSuccess,
  resolveCanonicalDebtBalance,
} from './mapping';
export type {
  AaveV4CollateralRiskConfig,
  AaveV4DebtState,
  AaveV4PositionIdentity,
  ApplicationPortfolio,
  PersistenceCollateralPosition,
  PersistenceDebtPosition,
  PersistenceMarketPrices,
  PersistencePortfolio,
  PersistenceProtocolParameters,
} from './models';
export {
  calculatePortfolioSummary,
  type PortfolioLiquidationSummary,
  type PortfolioSummary,
} from './summary';
export type { AaveProtocolVersion } from '@/engine';
