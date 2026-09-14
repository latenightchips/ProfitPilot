import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { calculateRiskCategory, type RiskCategory } from '../health/calculateRiskCategory';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateDebtValue } from '../portfolio/calculateDebtValue';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import type { Recommendation } from './types';

const FORMULA_ID = 'F-060';
const FORMULA_VERSION = '1.0';

/**
 * Health Factor Recommendation — 02_Formulas.md F-060. Owner decision
 * (PROJECT_STATUS.md conflict #1, closed): consumes `calculateRiskCategory`
 * (F-026) directly rather than maintaining a second threshold table —
 * there is exactly ONE Health Factor classification in this codebase, and
 * this function only ever layers guidance text on top of it. Never
 * recomputes or re-derives a Risk Category from Health Factor itself.
 *
 * Guidance mapping is the exact, literal owner decision — not inferred,
 * not reworded, and not extended with a sixth historical sentence
 * ("Consider monitoring weekly." / "Consider partial repayment.") that
 * the owner explicitly excluded from the canonical mapping:
 *
 *   SAFE              → "No action required."
 *   MONITOR           → "No action required." (intentionally identical to SAFE)
 *   ELEVATED          → "Avoid additional borrowing."
 *   HIGH RISK         → "Reduce debt or add collateral."
 *   LIQUIDATION RISK  → "Immediate action recommended."
 *
 * Recommendation/guidance only — never automatically repays, adds
 * collateral, borrows, loops, or exits (owner instruction, restated from
 * every sibling F-061/F-062/F-063/F-064/F-065's own identical
 * discipline).
 */
export interface HealthFactorRecommendationParams {
  portfolio: PortfolioInput;
}

const GUIDANCE_BY_RISK_CATEGORY: Record<RiskCategory, string> = {
  SAFE: 'No action required.',
  MONITOR: 'No action required.',
  ELEVATED: 'Avoid additional borrowing.',
  'HIGH RISK': 'Reduce debt or add collateral.',
  'LIQUIDATION RISK': 'Immediate action recommended.',
};

/**
 * SAFE/MONITOR both carry "No action required." — the non-actionable
 * pair. ELEVATED/HIGH RISK/LIQUIDATION RISK each carry real guidance —
 * the actionable set. Used by `features/recommendations/utils/recommendationTaxonomy.ts`'s
 * own `isActionableRecommendation` (re-derived from `relevantValues.healthFactor`
 * via `calculateRiskCategory`, not duplicated as a second literal set
 * there) to decide severity, mirroring every sibling recommendation's own
 * "actionable vs. confirmation" distinction.
 */
export const HEALTH_FACTOR_ACTIONABLE_CATEGORIES: ReadonlySet<RiskCategory> = new Set([
  'ELEVATED',
  'HIGH RISK',
  'LIQUIDATION RISK',
]);

export function calculateHealthFactorRecommendation(
  params: HealthFactorRecommendationParams,
): FormulaResult<Recommendation> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio } = params;

  const collateralValueResult = calculateCollateralValue(portfolio.collateral, portfolio.market);
  if (!collateralValueResult.ok) return createFailure(collateralValueResult.error, options);

  const debtValueResult = calculateDebtValue(portfolio.debt);
  if (!debtValueResult.ok) return createFailure(debtValueResult.error, options);

  const healthFactorResult = calculateHealthFactor(
    collateralValueResult.value,
    portfolio.protocol.liquidationThreshold,
    debtValueResult.value,
  );
  if (!healthFactorResult.ok) return createFailure(healthFactorResult.error, options);

  const riskCategoryResult = calculateRiskCategory(healthFactorResult.value);
  if (!riskCategoryResult.ok) return createFailure(riskCategoryResult.error, options);

  const riskCategory = riskCategoryResult.value;

  const warnings = [
    ...collateralValueResult.warnings,
    ...debtValueResult.warnings,
    ...healthFactorResult.warnings,
  ];

  return createSuccess(
    {
      category: 'healthFactor',
      triggeringCondition: `Health Factor risk category: ${riskCategory}.`,
      relevantValues: { healthFactor: healthFactorResult.value },
      expectedEffect: `Reflects the portfolio's current ${riskCategory} Health Factor risk category.`,
      // `decisionPriority` was not part of the owner's guidance-mapping
      // decision; fixed here to the single highest documented safety tier
      // ("Safety always has higher priority than profitability" —
      // 02_Formulas.md's own DECISION PRIORITY list), the same "one fixed
      // value regardless of branch" convention every sibling
      // F-061/F-062/F-063/F-064/F-065 already uses — `severityFor`'s own
      // non-actionable-demotes-to-Informational rule
      // (recommendationTaxonomy.ts) means SAFE/MONITOR still render as
      // 'Informational' despite this fixed value, exactly like a
      // "borrowing is acceptable" F-061 result already does today.
      decisionPriority: 'Prevent Liquidation',
      suggestedAction: GUIDANCE_BY_RISK_CATEGORY[riskCategory],
      formulaReferences: ['F-060', 'F-026', 'F-022'],
    },
    options,
    warnings,
  );
}
