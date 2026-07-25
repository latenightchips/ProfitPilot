/**
 * Portfolio Service — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-004 ("Implement Portfolio Mapping Utilities") is its
 * first occupant. The Portfolio Service itself (M3-005/M3-006) is a
 * separate, dependent Milestone 3 task not yet implemented.
 */
export {
  mapApplicationPortfolioToEngineInput,
  mapPersistencePortfolioToApplicationPortfolio,
  type MappingFailure,
  type MappingResult,
  type MappingSuccess,
} from './mapping';
export type {
  ApplicationPortfolio,
  PersistenceCollateralPosition,
  PersistenceDebtPosition,
  PersistenceMarketPrices,
  PersistencePortfolio,
  PersistenceProtocolParameters,
} from './models';
