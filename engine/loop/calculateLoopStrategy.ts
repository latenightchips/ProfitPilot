import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateEffectiveLeverage } from '../portfolio/calculateEffectiveLeverage';
import { calculateNetWorth } from '../portfolio/calculateNetWorth';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';
import type {
  CollateralPosition,
  DebtPosition,
  ExecutionCostAssumptions,
  MarketPrices,
  PercentageDecimal,
  PortfolioInput,
  ProtocolParameters,
} from '../shared/types';
import {
  validatePercentage,
  validatePositive,
  validateProtocolParameters,
} from '../validation/validate';
import { calculateLoopStep, type LoopStepResult } from './calculateLoopStep';

const FORMULA_ID = 'F-018';
const FORMULA_VERSION = '1.0';

export interface LoopStrategyInput {
  collateral: CollateralPosition;
  debt: DebtPosition;
  market: MarketPrices;
  protocol: ProtocolParameters;
  targetBorrowPercentage: PercentageDecimal;
  maxLoops: number;
  minHealthFactor: number;
  /**
   * Optional execution-cost friction assumptions (02_Formulas.md F-070,
   * V4 Readiness Audit §12 P1-5) — passed identically to every step's own
   * `calculateLoopStep` call, so a later step's `availableBorrow` is
   * computed from the ALREADY-frictioned collateral the prior step
   * produced. Omitted (or both rates zero) reproduces the pre-P1-5
   * frictionless behavior exactly.
   */
  executionCostAssumptions?: ExecutionCostAssumptions;
}

export interface LoopStepRecord extends LoopStepResult {
  stepNumber: number;
}

/**
 * Why the loop stopped, per 06_TASKS.md M2-016's "Stop reason" output.
 * MAX_LOOPS_REACHED and MIN_HEALTH_FACTOR_REACHED are the two limits named
 * in M2-016's own inputs ("Maximum number of loops", "Minimum Health
 * Factor"). NO_AVAILABLE_BORROW covers F-018's pseudo-algorithm running out
 * of borrow capacity before either configured limit is hit.
 */
export type LoopStopReason =
  'MAX_LOOPS_REACHED' | 'MIN_HEALTH_FACTOR_REACHED' | 'NO_AVAILABLE_BORROW';

export interface LoopStrategyResult {
  steps: LoopStepRecord[];
  finalCollateral: CollateralPosition;
  finalDebt: number;
  finalEquity: number;
  finalLeverage: number;
  finalHealthFactor: number;
  stopReason: LoopStopReason;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Multi-Step Loop Strategy — 06_TASKS.md M2-016 ("Implement Multi-Step Loop
 * Strategy").
 *
 * Repeatedly applies calculateLoopStep (M2-015), realizing:
 *   - F-016 "Recursive Exposure": cumulative BTC holdings grow by one
 *     step's purchase each iteration (steps[].collateralAfter).
 *   - F-018 "Maximum Loop Count": 02_Formulas.md documents this as an
 *     iterative algorithm, not a closed-form equation ("ProfitPilot
 *     intentionally avoids a fixed mathematical formula. The Loop
 *     Simulator determines this iteratively... Stop when Target Health
 *     Factor reached."). This function is that algorithm: it loops while
 *     the Health Factor after a prospective step would remain above
 *     minHealthFactor, and stops (without committing the breaching step)
 *     once it would not — 06_TASKS.md M2-016 DoD, "The strategy stops
 *     safely when a configured limit is reached."
 * Final "leverage" reuses calculateEffectiveLeverage (F-011); final
 * "equity" reuses calculateNetWorth (F-004) — 06_TASKS.md M2-016 does not
 * name a new Formula ID for either.
 *
 * 06_TASKS.md M2-016 also lists "Fees and slippage assumptions" as an
 * input. No equation for fees or slippage exists anywhere in
 * 02_Formulas.md (the same gap blocking parts of M2-017 — see
 * PROJECT_STATUS.md), so no such parameter is accepted here: inventing a
 * fee/slippage deduction would violate "do not invent architecture."
 */
export function calculateLoopStrategy(input: LoopStrategyInput): FormulaResult<LoopStrategyResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...input },
  };

  const protocolValidation = validateProtocolParameters(input.protocol);
  if (!protocolValidation.ok) return createFailure(protocolValidation.error, options);

  const targetBorrowPercentage = validatePercentage(
    input.targetBorrowPercentage,
    'targetBorrowPercentage',
  );
  if (!targetBorrowPercentage.ok) return createFailure(targetBorrowPercentage.error, options);

  if (!isPositiveInteger(input.maxLoops)) {
    return createFailure(
      { code: 'INVALID_MAX_LOOPS', message: 'maxLoops must be a non-negative integer.' },
      options,
    );
  }

  const minHealthFactor = validatePositive(input.minHealthFactor, 'minHealthFactor');
  if (!minHealthFactor.ok) return createFailure(minHealthFactor.error, options);

  const warnings: FormulaWarning[] = [];
  const steps: LoopStepRecord[] = [];

  let currentCollateral: CollateralPosition = { ...input.collateral };
  let currentDebt = input.debt.balance;
  let stopReason: LoopStopReason = 'MAX_LOOPS_REACHED';

  for (let stepNumber = 1; stepNumber <= input.maxLoops; stepNumber += 1) {
    const stepResult = calculateLoopStep({
      collateral: currentCollateral,
      debt: { asset: input.debt.asset, balance: currentDebt },
      market: input.market,
      protocol: input.protocol,
      borrowPercentage: targetBorrowPercentage.value.toNumber(),
      executionCostAssumptions: input.executionCostAssumptions,
    });
    if (!stepResult.ok) return createFailure(stepResult.error, options);

    if (stepResult.value.borrowedAmount <= 0) {
      stopReason = 'NO_AVAILABLE_BORROW';
      break;
    }

    if (stepResult.value.newHealthFactor <= input.minHealthFactor) {
      stopReason = 'MIN_HEALTH_FACTOR_REACHED';
      break;
    }

    warnings.push(...stepResult.warnings);
    steps.push({ ...stepResult.value, stepNumber });
    currentCollateral = stepResult.value.collateralAfter;
    currentDebt = stepResult.value.debtAfter;
  }

  // currentCollateral is always either the validated initial input or a
  // committed step's collateralAfter (itself always valid, see
  // calculateLoopStep.ts), so this branch is unreachable given valid
  // inputs; kept for defense in depth.
  const finalCollateralValueResult = calculateCollateralValue(currentCollateral, input.market);
  if (!finalCollateralValueResult.ok)
    return createFailure(finalCollateralValueResult.error, options);

  const finalPortfolio: PortfolioInput = {
    collateral: currentCollateral,
    debt: { asset: input.debt.asset, balance: currentDebt },
    market: input.market,
    protocol: input.protocol,
  };

  const finalEquityResult = calculateNetWorth(finalPortfolio);
  if (!finalEquityResult.ok) return createFailure(finalEquityResult.error, options);

  const finalLeverageResult = calculateEffectiveLeverage(finalPortfolio);
  if (!finalLeverageResult.ok) return createFailure(finalLeverageResult.error, options);

  const finalHealthFactorResult = calculateHealthFactor(
    finalCollateralValueResult.value,
    input.protocol.liquidationThreshold,
    currentDebt,
  );
  if (!finalHealthFactorResult.ok) return createFailure(finalHealthFactorResult.error, options);

  warnings.push(
    ...finalCollateralValueResult.warnings,
    ...finalEquityResult.warnings,
    ...finalLeverageResult.warnings,
    ...finalHealthFactorResult.warnings,
  );

  return createSuccess(
    {
      steps,
      finalCollateral: currentCollateral,
      finalDebt: currentDebt,
      finalEquity: finalEquityResult.value,
      finalLeverage: finalLeverageResult.value,
      finalHealthFactor: finalHealthFactorResult.value,
      stopReason,
    },
    options,
    warnings,
  );
}
