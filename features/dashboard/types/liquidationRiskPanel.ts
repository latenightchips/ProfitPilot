import type { DashboardMetric } from './viewModel';

/**
 * Liquidation Risk Panel types — 06_TASKS.md M5-009 ("Implement
 * Liquidation Risk Panel"). Dependencies: M5-003, M2-010. DoD: "The
 * section clearly distinguishes current values from calculated
 * estimates."
 *
 * Reuses `DashboardMetric` (M5-003) for the three fields already present
 * on `DashboardMetrics` — `liquidationPrice`, `liquidationDistance`,
 * `liquidationBuffer` ("Percentage decline to liquidation") — rather
 * than recomputing them a second time; this panel is the "later,
 * dedicated section" `DashboardKpiGrid`'s own Batch 3 comment already
 * named as the eventual home for those two fields it deliberately left
 * out of the 8-card grid.
 *
 * `debtRepaymentRequired`/`collateralAdditionRequired` come from the same
 * `calculateTargetHealthFactorActions` Service `HealthFactorStatus`
 * (M5-007) uses — see that file's own header comment for why it exists
 * instead of `generateRecommendationSet`. Both are `null` under the exact
 * same condition: no configured target Health Factor.
 */
export interface LiquidationRiskPanelData {
  estimatedLiquidationPrice: DashboardMetric;
  percentageDeclineToLiquidation: DashboardMetric;
  liquidationDistance: DashboardMetric;
  /** A *current*, not calculated, value — see this file's own DoD note. `null` only in the practically-unreachable freshness-lookup-failure case. */
  currentMarketPrice: string | null;
  /** Formatted currency. `null` when no target Health Factor is configured. */
  debtRepaymentRequired: string | null;
  /** Formatted currency. `null` when no target Health Factor is configured. */
  collateralAdditionRequired: string | null;
  assumptions: string;
}
