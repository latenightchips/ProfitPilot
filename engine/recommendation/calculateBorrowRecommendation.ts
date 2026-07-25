import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { calculateAvailableBorrow } from '../loop/calculateBorrowCapacity';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateDebtRatio } from '../portfolio/calculateDebtRatio';
import { calculateDebtValue } from '../portfolio/calculateDebtValue';
import { calculatePortfolioValue } from '../portfolio/calculatePortfolioValue';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { validatePercentage, validatePositive } from '../validation/validate';
import type { Recommendation } from './types';

const FORMULA_ID = 'F-061';
const FORMULA_VERSION = '1.0';

export interface BorrowRecommendationParams {
  portfolio: PortfolioInput;
  /** "Target HF remains above user minimum" — caller-supplied floor. */
  userMinHealthFactor: number;
  /** "Debt Ratio below target" — caller-supplied ceiling (decimal, e.g. 0.5 for 50%). */
  targetDebtRatio: number;
}

/**
 * Borrow Recommendation — 02_Formulas.md F-061.
 * Conditions (all must hold): Target HF remains above user minimum /
 * Available Borrow > 0 / Debt Ratio below target. Reuses Health Factor
 * (F-022), Available Borrow (F-013), and Debt Ratio (F-006, promoted
 * from unassigned this batch — see PROJECT_STATUS.md) rather than
 * recomputing any of them.
 *
 * "User minimum" and "target" are caller-supplied thresholds, not
 * engine-invented constants — 02_Formulas.md never states numeric values
 * for either, consistent with every other Engine function that accepts
 * business-rule thresholds as parameters (e.g. `calculateLoopStrategy`'s
 * `minHealthFactor`).
 */
export function calculateBorrowRecommendation(
  params: BorrowRecommendationParams,
): FormulaResult<Recommendation> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio, userMinHealthFactor, targetDebtRatio } = params;

  const minHf = validatePositive(userMinHealthFactor, 'userMinHealthFactor');
  if (!minHf.ok) return createFailure(minHf.error, options);

  const targetRatio = validatePercentage(targetDebtRatio, 'targetDebtRatio');
  if (!targetRatio.ok) return createFailure(targetRatio.error, options);

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

  const availableBorrowResult = calculateAvailableBorrow(
    collateralValueResult.value,
    portfolio.protocol.maxLoanToValue,
    debtValueResult.value,
  );
  if (!availableBorrowResult.ok) return createFailure(availableBorrowResult.error, options);

  // portfolio.collateral and portfolio.market were already validated
  // above (via collateralValueResult); unreachable given valid inputs,
  // kept for defense in depth.
  const portfolioValueResult = calculatePortfolioValue(portfolio.collateral, portfolio.market);
  if (!portfolioValueResult.ok) return createFailure(portfolioValueResult.error, options);

  // debtValueResult.value and portfolioValueResult.value are both
  // already proven non-negative; unreachable given valid inputs, kept
  // for defense in depth.
  const debtRatioResult = calculateDebtRatio(debtValueResult.value, portfolioValueResult.value);
  if (!debtRatioResult.ok) return createFailure(debtRatioResult.error, options);

  const healthFactorOk = healthFactorResult.value > userMinHealthFactor;
  const availableBorrowOk = availableBorrowResult.value > 0;
  const debtRatioOk = debtRatioResult.value < targetDebtRatio;
  const acceptable = healthFactorOk && availableBorrowOk && debtRatioOk;

  const warnings = [
    ...collateralValueResult.warnings,
    ...debtValueResult.warnings,
    ...healthFactorResult.warnings,
    ...availableBorrowResult.warnings,
    ...portfolioValueResult.warnings,
    ...debtRatioResult.warnings,
  ];

  return createSuccess(
    {
      category: 'debtManagement',
      triggeringCondition: acceptable
        ? 'Health Factor above minimum, borrow capacity available, and Debt Ratio below target.'
        : 'One or more of: Health Factor at or below minimum, no available borrow capacity, or Debt Ratio at or above target.',
      relevantValues: {
        healthFactor: healthFactorResult.value,
        userMinHealthFactor,
        availableBorrow: availableBorrowResult.value,
        debtRatio: debtRatioResult.value,
        targetDebtRatio,
      },
      expectedEffect: acceptable
        ? 'Additional borrowing remains within the configured safety and leverage limits.'
        : 'Additional borrowing would violate at least one configured safety or leverage limit.',
      decisionPriority: 'Improve Capital Efficiency',
      suggestedAction: acceptable
        ? 'Borrowing is acceptable.'
        : 'Do not recommend additional borrowing.',
      formulaReferences: ['F-061', 'F-022', 'F-013', 'F-006'],
    },
    options,
    warnings,
  );
}
