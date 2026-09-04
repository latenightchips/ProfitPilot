/**
 * Portfolio History Service — public entry point. V1.1 Batch 2
 * ("Portfolio History & Risk Timeline"). Pure snapshot-building,
 * material-change, and before/after comparison logic, plus the one
 * orchestration function that ties them to persistence
 * (`attemptPortfolioHistorySnapshot`). `stores/portfolioStore.ts` is the
 * only Store-layer consumer; UI components read persisted entries
 * directly via `services/persistence`'s `listPortfolioHistoryForPortfolio`
 * (the same "Store/UI reads persistence directly for a list, Services
 * only computes" split `docs/settings` Recovery Snapshots already uses).
 */
export { attemptPortfolioHistorySnapshot } from './attemptPortfolioHistorySnapshot';
export { buildPortfolioHistoryEntry } from './buildPortfolioHistoryEntry';
export { calculateLiquidationBufferPercent } from './calculateLiquidationBufferPercent';
export {
  comparePortfolioHistoryEntries,
  type PortfolioHistoryComparison,
  type PortfolioHistoryMetricDelta,
  type PortfolioHistoryNullableMetricDelta,
  type PortfolioHistoryOptionalMetricDelta,
} from './comparePortfolioHistoryEntries';
export { isMaterialPortfolioHistoryChange } from './isMaterialPortfolioHistoryChange';
