/**
 * Liquidation Risk Panel builder — 06_TASKS.md M5-009. See
 * `../types/liquidationRiskPanel.ts` for the full design reasoning.
 */
import { calculateTargetHealthFactorActions } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type { LiquidationRiskPanelData } from '../types/liquidationRiskPanel';
import type { DashboardMarketFreshness, DashboardMetrics } from '../types/viewModel';
import { formatCurrency } from './format';

/** Matches `stores/portfolioStore.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

const ASSUMPTIONS =
  'Assumes the current BTC price and protocol parameters (borrow APR, supply APR, ' +
  'maximum LTV, liquidation threshold) remain unchanged. These estimates recalculate ' +
  'automatically whenever the underlying portfolio data changes.';

/**
 * Builds the Liquidation Risk Panel view model. Reuses the liquidation
 * trio already present on `DashboardMetrics` (M5-003) rather than
 * recomputing them, and calls the same `calculateTargetHealthFactorActions`
 * Service `buildHealthFactorStatus` (M5-007) uses for the two "required
 * for target safety" fields — `null` on both whenever no target Health
 * Factor is configured, matching that file's own condition exactly.
 */
export function buildLiquidationRiskPanel(
  portfolio: Portfolio,
  metrics: DashboardMetrics,
  marketFreshness: DashboardMarketFreshness | null,
): LiquidationRiskPanelData {
  const target = portfolio.settings.safetyTargets?.targetHealthFactor ?? null;

  let debtRepaymentRequired: string | null = null;
  let collateralAdditionRequired: string | null = null;
  if (target !== null) {
    const actionsResult = calculateTargetHealthFactorActions(portfolio, target, SOURCE_STATUS);
    if (actionsResult.ok) {
      debtRepaymentRequired = formatCurrency(
        actionsResult.data.repayment.relevantValues.requiredRepayment,
      );
      collateralAdditionRequired = formatCurrency(
        actionsResult.data.additionalCollateral.relevantValues.requiredUsd,
      );
    }
  }

  return {
    estimatedLiquidationPrice: metrics.liquidationPrice,
    percentageDeclineToLiquidation: metrics.liquidationBuffer,
    liquidationDistance: metrics.liquidationDistance,
    currentMarketPrice: marketFreshness !== null ? marketFreshness.formattedPrice : null,
    debtRepaymentRequired,
    collateralAdditionRequired,
    assumptions: ASSUMPTIONS,
  };
}
