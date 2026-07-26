/**
 * Leverage Summary builder — 06_TASKS.md M5-014. See
 * `../types/leverageSummary.ts` for the full design reasoning.
 */
import type { PortfolioSummary } from '@/services';

import type { LeverageSummary } from '../types/leverageSummary';
import { formatCurrency, formatLeverage } from './format';

/**
 * `leverage` is always finite here: `calculatePortfolioSummary` (F-011,
 * `calculateEffectiveLeverage` = Exposure / Net Worth) fails the whole
 * summary with `DIVISION_BY_ZERO` when net worth is zero — the only way
 * leverage could be non-finite — so a `PortfolioSummary` this function
 * receives always carries a real, computed value. At zero debt, net
 * worth equals exposure, so leverage is exactly `1`, not `Infinity`.
 */
function buildExplanation(leverage: number): string {
  if (leverage === 1) {
    return 'This portfolio is not leveraged — your net equity equals your total Bitcoin exposure.';
  }
  return `This portfolio is leveraged ${formatLeverage(leverage)}: your total Bitcoin exposure is ${formatLeverage(leverage)} your net equity.`;
}

export function buildLeverageSummary(summary: PortfolioSummary): LeverageSummary {
  return {
    formattedGrossExposure: formatCurrency(summary.collateralValue),
    formattedNetEquity: formatCurrency(summary.netEquity),
    formattedLeverageRatio: formatLeverage(summary.leverage),
    formattedEffectiveBtcExposure: formatCurrency(summary.collateralValue),
    explanation: buildExplanation(summary.leverage),
  };
}
