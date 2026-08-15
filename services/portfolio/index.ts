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
 * types, not new models.
 */
export {
  type PortfolioAction,
  type PortfolioActionPreview,
  previewPortfolioAction,
} from './actionPreview';
export { calculatePortfolioExposure } from './exposure';
export { calculateDebtInterestBreakdown, type DebtInterestBreakdown } from './interestBreakdown';
export {
  mapApplicationPortfolioToEngineInput,
  mapPersistencePortfolioToApplicationPortfolio,
  type MappingFailure,
  type MappingResult,
  type MappingSuccess,
} from './mapping';
export type {
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
