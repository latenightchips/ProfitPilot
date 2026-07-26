/**
 * Health Factor Status builder — 06_TASKS.md M5-007. See
 * `../types/healthFactorStatus.ts` for the full design reasoning.
 */
import { calculateTargetHealthFactorActions, type PortfolioSummary } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type { HealthFactorStatus } from '../types/healthFactorStatus';
import { formatHealthFactor, formatNumber } from './format';

/** Matches `stores/portfolioStore.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

function buildExplanation(current: number, target: number | null): string {
  if (target === null) {
    return 'No target Health Factor is configured for this portfolio.';
  }
  if (current > target) return 'Health Factor is above your configured target.';
  if (current === target) return 'Health Factor is exactly at your configured target.';
  return 'Health Factor is below your configured target.';
}

/**
 * Builds the Health Factor Status view model from an already-successful
 * `PortfolioSummary` (M3-005) and the portfolio's own configured target,
 * if any. Never invents a target, and never classifies risk — see this
 * module's own header comment.
 */
export function buildHealthFactorStatus(
  portfolio: Portfolio,
  summary: PortfolioSummary,
): HealthFactorStatus {
  const target = portfolio.settings.safetyTargets?.targetHealthFactor ?? null;
  const current = summary.healthFactor;
  const distanceFromTarget = target !== null && Number.isFinite(current) ? current - target : null;

  let requiredActions: HealthFactorStatus['requiredActions'] = null;
  if (target !== null) {
    const actionsResult = calculateTargetHealthFactorActions(portfolio, target, SOURCE_STATUS);
    if (actionsResult.ok) {
      requiredActions = {
        repayment: actionsResult.data.repayment.suggestedAction,
        additionalCollateral: actionsResult.data.additionalCollateral.suggestedAction,
      };
    }
  }

  return {
    currentHealthFactor: current,
    formattedCurrentHealthFactor: formatHealthFactor(current),
    configuredTarget: target,
    formattedConfiguredTarget: target !== null ? formatHealthFactor(target) : null,
    distanceFromTarget,
    formattedDistanceFromTarget:
      distanceFromTarget !== null ? formatNumber(distanceFromTarget) : null,
    explanation: buildExplanation(current, target),
    requiredActions,
  };
}
