import { calculateBtcSaleRequired } from '../exit/calculateBtcSaleRequired';
import { calculateRequiredDebtRepayment } from '../exit/calculateRequiredDebtRepayment';
import { calculateTargetDebt } from '../exit/calculateTargetDebt';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateDebtValue } from '../portfolio/calculateDebtValue';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import type { Recommendation } from './types';

const FORMULA_ID = 'F-062';
const FORMULA_VERSION = '1.0';

export interface RepaymentRecommendationParams {
  portfolio: PortfolioInput;
  targetHealthFactor: number;
}

/**
 * Repayment Recommendation — 02_Formulas.md F-062.
 * Equation: Required Repayment = Current Debt − Target Debt, explicitly
 * "Reference: F-040" in the doc — the identical equation already
 * implemented as F-041 "Required Debt Repayment" (M2-023, Batch 9),
 * itself built on F-040 "Target Debt". Reused rather than duplicated,
 * the same F-012/F-021-style pattern used throughout this Engine.
 * Outputs: USD (repayment) / Estimated BTC Required (F-042, reused) /
 * Expected Health Factor (the target itself, since F-040 is derived from
 * it).
 */
export function calculateRepaymentRecommendation(
  params: RepaymentRecommendationParams,
): FormulaResult<Recommendation> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio, targetHealthFactor } = params;

  const collateralValueResult = calculateCollateralValue(portfolio.collateral, portfolio.market);
  if (!collateralValueResult.ok) return createFailure(collateralValueResult.error, options);

  const debtValueResult = calculateDebtValue(portfolio.debt);
  if (!debtValueResult.ok) return createFailure(debtValueResult.error, options);

  const targetDebtResult = calculateTargetDebt(
    collateralValueResult.value,
    portfolio.protocol.liquidationThreshold,
    targetHealthFactor,
  );
  if (!targetDebtResult.ok) return createFailure(targetDebtResult.error, options);

  // debtValueResult.value and targetDebtResult.value are both already
  // proven non-negative; unreachable given valid inputs, kept for
  // defense in depth.
  const repaymentResult = calculateRequiredDebtRepayment(
    debtValueResult.value,
    targetDebtResult.value,
  );
  if (!repaymentResult.ok) return createFailure(repaymentResult.error, options);

  // repaymentResult.value is already proven non-negative, and
  // portfolio.market.btcPriceUsd was already validated above (via
  // calculateCollateralValue); unreachable given valid inputs, kept for
  // defense in depth.
  const btcRequiredResult = calculateBtcSaleRequired(
    repaymentResult.value,
    portfolio.market.btcPriceUsd,
  );
  if (!btcRequiredResult.ok) return createFailure(btcRequiredResult.error, options);

  const warnings = [
    ...collateralValueResult.warnings,
    ...debtValueResult.warnings,
    ...targetDebtResult.warnings,
    ...repaymentResult.warnings,
    ...btcRequiredResult.warnings,
  ];

  const noRepaymentNeeded = repaymentResult.value === 0;

  return createSuccess(
    {
      category: 'debtManagement',
      triggeringCondition: noRepaymentNeeded
        ? 'Current debt is already at or below the target for the requested Health Factor.'
        : 'Current debt exceeds the target debt required to reach the requested Health Factor.',
      relevantValues: {
        currentDebt: debtValueResult.value,
        targetDebt: targetDebtResult.value,
        targetHealthFactor,
        requiredRepayment: repaymentResult.value,
        estimatedBtcRequired: btcRequiredResult.value,
      },
      expectedEffect: `Repaying ${repaymentResult.value} would bring Health Factor to approximately ${targetHealthFactor}.`,
      decisionPriority: 'Maintain Target Health Factor',
      suggestedAction: noRepaymentNeeded
        ? 'No repayment needed.'
        : `Repay ${repaymentResult.value} (approximately ${btcRequiredResult.value} BTC at the current price).`,
      formulaReferences: ['F-062', 'F-040', 'F-041', 'F-042'],
    },
    options,
    warnings,
  );
}
