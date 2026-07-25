import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateDebtValue } from '../portfolio/calculateDebtValue';
import { toDecimal, toOutputNumber } from '../shared/decimal';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { validatePositive, validatePrice, validateThreshold } from '../validation/validate';
import type { Recommendation } from './types';

const FORMULA_ID = 'F-063';
const FORMULA_VERSION = '1.0';

export interface AdditionalCollateralRecommendationParams {
  portfolio: PortfolioInput;
  targetHealthFactor: number;
}

/**
 * Additional Collateral Recommendation — 02_Formulas.md F-063.
 * Purpose: "Estimate collateral required to reach target Health Factor."
 * No equation is given directly, but one is derivable without inventing
 * anything: F-022's own equation (Health Factor = (Collateral Value ×
 * Liquidation Threshold) / Debt) rearranged for Collateral Value —
 * Target Collateral Value = (Target HF × Debt) / Liquidation Threshold —
 * the exact mirror of F-040 "Target Debt" (Target Debt = (Collateral ×
 * Liquidation Threshold) / Target HF), solved for the other variable of
 * the same equation.
 *
 * Output: Required USD (additional collateral value needed, clamped to 0
 * per F-041's own `Math.max(0, ...)` convention for the analogous debt
 * case) / Equivalent BTC / Expected Health Factor, verified by
 * recomputing F-022 with the resulting collateral value — the same
 * verification pattern `calculateAdditionalBorrow` (F-027) established.
 */
export function calculateAdditionalCollateralRecommendation(
  params: AdditionalCollateralRecommendationParams,
): FormulaResult<Recommendation> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio, targetHealthFactor } = params;

  const targetHf = validatePositive(targetHealthFactor, 'targetHealthFactor');
  if (!targetHf.ok) return createFailure(targetHf.error, options);

  const threshold = validateThreshold(
    portfolio.protocol.liquidationThreshold,
    'portfolio.protocol.liquidationThreshold',
  );
  if (!threshold.ok) return createFailure(threshold.error, options);

  const btcPrice = validatePrice(portfolio.market.btcPriceUsd, 'portfolio.market.btcPriceUsd');
  if (!btcPrice.ok) return createFailure(btcPrice.error, options);

  const collateralValueResult = calculateCollateralValue(portfolio.collateral, portfolio.market);
  if (!collateralValueResult.ok) return createFailure(collateralValueResult.error, options);

  const debtValueResult = calculateDebtValue(portfolio.debt);
  if (!debtValueResult.ok) return createFailure(debtValueResult.error, options);

  const targetCollateralValue = toDecimal(targetHf.value)
    .times(debtValueResult.value)
    .dividedBy(threshold.value);

  const requiredUsdRaw = targetCollateralValue.minus(collateralValueResult.value);
  const requiredUsd = requiredUsdRaw.isNegative() ? toDecimal(0) : requiredUsdRaw;
  const equivalentBtc = requiredUsd.dividedBy(btcPrice.value);

  const warnings: FormulaWarning[] = [
    ...collateralValueResult.warnings,
    ...debtValueResult.warnings,
  ];

  const noAdditionalCollateralNeeded = requiredUsd.isZero();
  const verificationCollateralValue = toDecimal(collateralValueResult.value).plus(requiredUsd);
  const verification = calculateHealthFactor(
    toOutputNumber(verificationCollateralValue),
    portfolio.protocol.liquidationThreshold,
    debtValueResult.value,
  );
  let expectedHealthFactor = targetHealthFactor;
  if (
    verification.ok &&
    Number.isFinite(verification.value) &&
    !toDecimal(verification.value).minus(targetHf.value).abs().lessThanOrEqualTo('0.0000001')
  ) {
    warnings.push({
      code: 'TARGET_VERIFICATION_MISMATCH',
      message:
        'Recomputing Health Factor with the resulting collateral did not reproduce the target Health Factor.',
    });
    expectedHealthFactor = verification.value;
  }

  return createSuccess(
    {
      category: 'collateralManagement',
      triggeringCondition: noAdditionalCollateralNeeded
        ? 'Current collateral already supports the requested Health Factor.'
        : 'Current collateral is insufficient to reach the requested Health Factor.',
      relevantValues: {
        currentCollateralValue: collateralValueResult.value,
        targetCollateralValue: toOutputNumber(targetCollateralValue),
        targetHealthFactor,
        requiredUsd: toOutputNumber(requiredUsd),
        equivalentBtc: toOutputNumber(equivalentBtc),
      },
      expectedEffect: `Adding ${toOutputNumber(requiredUsd)} in collateral would bring Health Factor to approximately ${expectedHealthFactor}.`,
      decisionPriority: 'Maintain Target Health Factor',
      suggestedAction: noAdditionalCollateralNeeded
        ? 'No additional collateral needed.'
        : `Add ${toOutputNumber(requiredUsd)} in collateral (approximately ${toOutputNumber(equivalentBtc)} BTC at the current price).`,
      formulaReferences: ['F-063', 'F-022'],
    },
    options,
    warnings,
  );
}
