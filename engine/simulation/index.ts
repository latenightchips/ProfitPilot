export { calculateDebtGrowth } from './calculateDebtGrowth';
export { calculatePortfolioGain } from './calculatePortfolioGain';
export {
  compareScenarios,
  type ScenarioComparisonResult,
  type ScenarioMetric,
  type ScenarioMetricDifference,
  type ScenarioSummary,
} from './compareScenarios';
export { type RankedScenario, rankScenarios } from './rankScenarios';
export { type PriceScenarioInput, resolveScenarioPrice } from './resolveScenarioPrice';
export {
  type InterestScenarioParams,
  type InterestScenarioResult,
  simulateInterestScenario,
} from './simulateInterestScenario';
export {
  type PortfolioSnapshot,
  type PositionChangeInput,
  type PositionChangeResult,
  simulatePositionChange,
} from './simulatePositionChange';
export {
  type PriceScenarioParams,
  type PriceScenarioResult,
  simulatePriceScenario,
} from './simulatePriceScenario';
