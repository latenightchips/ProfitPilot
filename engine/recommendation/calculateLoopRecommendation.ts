import { calculateAnnualInterest } from '../interest/calculateAnnualInterest';
import { calculateLoopStep } from '../loop/calculateLoopStep';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { validatePositive } from '../validation/validate';
import type { Recommendation } from './types';

const FORMULA_ID = 'F-064';
const FORMULA_VERSION = '1.0';

export interface LoopRecommendationParams {
  portfolio: PortfolioInput;
  targetHealthFactor: number;
  /** Fraction of available borrow capacity the proposed loop step would draw. */
  loopBorrowPercentage: number;
  /** Caller-supplied ceiling for "Interest Cost acceptable" — 02_Formulas.md gives no numeric threshold. */
  maxAcceptableAnnualInterestCost: number;
}

/**
 * Loop Recommendation — 02_Formulas.md F-064.
 * Conditions (all must hold): Health Factor remains above target /
 * Borrow Capacity available / Interest Cost acceptable. Reuses
 * `calculateLoopStep` (F-014, M2-015) to evaluate the proposed loop and
 * `calculateAnnualInterest` (F-032, M2-012) for its interest cost, rather
 * than recomputing either. "Interest Cost acceptable" has no documented
 * numeric threshold, so `maxAcceptableAnnualInterestCost` is a required
 * caller-supplied parameter, the same convention as `userMinHealthFactor`
 * in `calculateBorrowRecommendation`.
 *
 * Always reports the expected Health Factor after the proposed loop, per
 * the doc's own requirement ("The recommendation should always include
 * the expected Health Factor after the proposed loop").
 */
export function calculateLoopRecommendation(
  params: LoopRecommendationParams,
): FormulaResult<Recommendation> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio, targetHealthFactor, loopBorrowPercentage, maxAcceptableAnnualInterestCost } =
    params;

  const targetHf = validatePositive(targetHealthFactor, 'targetHealthFactor');
  if (!targetHf.ok) return createFailure(targetHf.error, options);

  const maxInterest = validatePositive(
    maxAcceptableAnnualInterestCost,
    'maxAcceptableAnnualInterestCost',
  );
  if (!maxInterest.ok) return createFailure(maxInterest.error, options);

  const stepResult = calculateLoopStep({
    collateral: portfolio.collateral,
    debt: portfolio.debt,
    market: portfolio.market,
    protocol: portfolio.protocol,
    borrowPercentage: loopBorrowPercentage,
  });
  if (!stepResult.ok) return createFailure(stepResult.error, options);

  // stepResult.value.borrowedAmount is always non-negative, and
  // portfolio.protocol.borrowApr was already validated by
  // calculateLoopStep's own validateProtocolParameters call; unreachable
  // given valid inputs, kept for defense in depth.
  const interestCostResult = calculateAnnualInterest(
    stepResult.value.borrowedAmount,
    portfolio.protocol.borrowApr,
  );
  if (!interestCostResult.ok) return createFailure(interestCostResult.error, options);

  const healthFactorOk = stepResult.value.newHealthFactor > targetHealthFactor;
  const borrowCapacityOk = stepResult.value.availableBorrow > 0;
  const interestCostOk = interestCostResult.value <= maxAcceptableAnnualInterestCost;
  const loopRecommended = healthFactorOk && borrowCapacityOk && interestCostOk;

  const warnings = [...stepResult.warnings, ...interestCostResult.warnings];

  return createSuccess(
    {
      category: 'leverage',
      triggeringCondition: loopRecommended
        ? 'Health Factor remains above target, borrow capacity is available, and the added interest cost is acceptable.'
        : 'One or more of: resulting Health Factor at or below target, no borrow capacity available, or interest cost exceeds the acceptable maximum.',
      relevantValues: {
        newHealthFactor: stepResult.value.newHealthFactor,
        targetHealthFactor,
        availableBorrow: stepResult.value.availableBorrow,
        annualInterestCost: interestCostResult.value,
        maxAcceptableAnnualInterestCost,
      },
      expectedEffect: `One more loop step would bring Health Factor to approximately ${stepResult.value.newHealthFactor}.`,
      decisionPriority: 'Improve Capital Efficiency',
      suggestedAction: loopRecommended ? 'Loop One More Time' : 'Stop Looping',
      formulaReferences: ['F-064', 'F-014', 'F-032'],
    },
    options,
    warnings,
  );
}
