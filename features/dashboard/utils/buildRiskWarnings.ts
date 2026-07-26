/**
 * Risk Warning builder — 06_TASKS.md M5-010. See
 * `../types/riskWarnings.ts` for the full design reasoning (which 3 of
 * the 6 documented "Warning cases" are built, and why the other 3 remain
 * blocked or unreachable).
 */
import type { HealthFactorStatus } from '../types/healthFactorStatus';
import type { RiskWarning } from '../types/riskWarnings';
import type { DashboardFreshness, DashboardWarning } from '../types/viewModel';

export function buildRiskWarnings(
  healthFactorStatus: HealthFactorStatus,
  freshness: DashboardFreshness,
  calculationWarnings: DashboardWarning[],
): RiskWarning[] {
  const warnings: RiskWarning[] = [];

  if (
    healthFactorStatus.configuredTarget !== null &&
    healthFactorStatus.distanceFromTarget !== null &&
    healthFactorStatus.distanceFromTarget < 0
  ) {
    warnings.push({
      code: 'HEALTH_FACTOR_BELOW_TARGET',
      reason: `Health Factor (${healthFactorStatus.formattedCurrentHealthFactor}) is below your configured target (${healthFactorStatus.formattedConfiguredTarget}).`,
      recommendedAction:
        'See the Health Factor Status section for specific repayment or collateral amounts to restore your target.',
    });
  }

  if (freshness.market === null) {
    warnings.push({
      code: 'PRICE_DATA_MISSING',
      reason: 'BTC price data is missing.',
      recommendedAction: 'Set a current BTC price on the Portfolio page.',
    });
  } else if (freshness.market.freshness === 'stale') {
    warnings.push({
      code: 'PRICE_DATA_STALE',
      reason: `BTC price data is stale (last updated ${freshness.market.formattedUpdatedAt}).`,
      recommendedAction:
        'Update the BTC price on the Portfolio page to ensure accurate calculations.',
    });
  }

  for (const warning of calculationWarnings) {
    warnings.push({
      code: warning.code,
      reason: warning.message,
      recommendedAction: 'Review the underlying portfolio data on the Portfolio page.',
    });
  }

  return warnings;
}
