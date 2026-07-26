/**
 * Recommendation Summary builder — 06_TASKS.md M5-015. See
 * `../types/recommendationSummary.ts` for the full design reasoning.
 */
import { calculateTargetHealthFactorActions, type Recommendation } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type {
  RecommendationSummary,
  RecommendationSummaryItem,
} from '../types/recommendationSummary';

/** Matches `stores/portfolioStore.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

function toItem(recommendation: Recommendation, priority: number): RecommendationSummaryItem {
  return {
    priority,
    category: recommendation.category,
    riskLevel: recommendation.decisionPriority,
    explanation: recommendation.triggeringCondition,
    suggestedAction: recommendation.suggestedAction,
    expectedEffect: recommendation.expectedEffect,
  };
}

export function buildRecommendationSummary(portfolio: Portfolio): RecommendationSummary {
  const target = portfolio.settings.safetyTargets?.targetHealthFactor ?? null;
  if (target === null) return { items: [] };

  const actionsResult = calculateTargetHealthFactorActions(portfolio, target, SOURCE_STATUS);
  if (!actionsResult.ok) return { items: [] };

  const items: RecommendationSummaryItem[] = [];
  const { repayment, additionalCollateral } = actionsResult.data;

  if (repayment.relevantValues.requiredRepayment > 0) {
    items.push(toItem(repayment, items.length + 1));
  }
  if (additionalCollateral.relevantValues.requiredUsd > 0) {
    items.push(toItem(additionalCollateral, items.length + 1));
  }

  return { items };
}
