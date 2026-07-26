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
 */
export {
  type PortfolioAction,
  type PortfolioActionPreview,
  previewPortfolioAction,
} from './actionPreview';
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
export {
  calculatePortfolioSummary,
  type PortfolioLiquidationSummary,
  type PortfolioSummary,
} from './summary';
