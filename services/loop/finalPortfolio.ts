import type { LoopStrategyResult } from '@/engine';

import type { ApplicationPortfolio } from '../portfolio/models';

/**
 * Builds the plain `ApplicationPortfolio` representing a Loop strategy's
 * own final state — extracted at Milestone 7 Batch 3 from
 * `LoopStrategySummary.tsx` (Batch 2), which was the first of now three
 * consumers (`LoopStrategySummary.tsx`, `LoopSafetyAnalysis.tsx` M7-013,
 * `stores/loopBuilderStore.ts`'s own `runSensitivityScenario` M7-015).
 * Pure object construction, not a calculation — `market`/`protocol` are
 * carried over unchanged from the starting portfolio (a loop changes
 * collateral/debt, never market price or protocol parameters), so no
 * value here is derived a second way; every consumer still reaches its
 * own numbers by passing this through `calculatePortfolioSummary`
 * (M3-005) or `simulateScenario` (M3-009), never by reading a field off
 * this object directly as a result.
 */
export function buildFinalLoopPortfolio(
  portfolio: ApplicationPortfolio,
  strategy: LoopStrategyResult,
): ApplicationPortfolio {
  return {
    collateral: strategy.finalCollateral,
    debt: { asset: portfolio.debt.asset, balance: strategy.finalDebt },
    market: portfolio.market,
    protocol: portfolio.protocol,
  };
}
