import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateNetWorth } from '../portfolio/calculateNetWorth';
import { toDecimal, toOutputNumber } from '../shared/decimal';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { validateNonNegative, validatePrice } from '../validation/validate';
import { calculateBtcSaleRequired } from './calculateBtcSaleRequired';
import { calculateRequiredDebtRepayment } from './calculateRequiredDebtRepayment';

const FORMULA_ID = 'F-042';
const FORMULA_VERSION = '1.0';

export interface UnavailableExitCost {
  item: 'swapFees' | 'slippage' | 'gasEstimate';
  reason: string;
}

const UNAVAILABLE_EXIT_COSTS: UnavailableExitCost[] = [
  {
    item: 'swapFees',
    reason: 'No Formula ID or equation for swap fees exists in 02_Formulas.md.',
  },
  {
    item: 'slippage',
    reason: 'No Formula ID or equation for slippage exists in 02_Formulas.md.',
  },
  {
    item: 'gasEstimate',
    reason: 'No Formula ID or equation for gas estimation exists in 02_Formulas.md.',
  },
];

export interface ExitPositionInput {
  portfolio: PortfolioInput;
  /** Debt remaining after the exit. 0 = full exit; any value in (0, currentDebt) = partial exit. */
  targetDebt: number;
  /** Optional scenario BTC price to execute the exit at — defaults to portfolio.market.btcPriceUsd. */
  scenarioBtcPriceUsd?: number;
}

export interface ExitPositionResult {
  /** Required Debt Repayment — F-041. */
  repayment: number;
  /** BTC Sale Required — F-042. */
  btcSold: number;
  btcRetained: number;
  remainingDebt: number;
  /** Collateral Value — F-002, on the retained BTC. */
  remainingCollateralValue: number;
  /** Net Equity — F-004 pattern, on the post-exit position. */
  remainingEquity: number;
  /** Exit transaction costs — not computed; see PROJECT_STATUS.md conflict #8. */
  unavailableCosts: UnavailableExitCost[];
}

/**
 * Exit Position Calculations — 06_TASKS.md M2-023 ("Implement Exit
 * Position Calculations").
 *
 * A single targetDebt parameter covers both documented outcomes: 0 is a
 * "Full-exit result" (all debt repaid); any value between 0 and current
 * debt is a "Partial-exit result" — the same "one function, parameterized"
 * pattern used throughout the Loop and Simulation chapters (M2-015,
 * M2-020, M2-021), rather than two separate functions.
 *
 * Composes F-041 (Required Debt Repayment) and F-042 (BTC Sale Required),
 * then F-002 (Collateral Value) and F-004 (Net Equity) on the resulting
 * retained-BTC / remaining-debt position — satisfying "Remaining equity"
 * and reconciling with current portfolio balances per the DoD. "BTC
 * quantity retained" (M2-023) is current holdings minus BTC sold, a plain
 * subtraction with no dedicated Formula ID, computed directly.
 *
 * `scenarioBtcPriceUsd` is optional and defaults to the portfolio's
 * current market price — this is how "Target BTC price" (a 06_TASKS.md
 * M2-024 target type) is satisfied: `06_TASKS.md` M7-021's own exit-type
 * list (a later milestone's UI task, read for context) does not include
 * "Target BTC price" among its selectable exit types, only among a
 * separate list of form inputs — meaning it is a price-scenario override
 * usable with any exit calculation, not a standalone target type. See
 * PROJECT_STATUS.md.
 *
 * "Exit transaction costs" (M2-023's own Include list) has no documented
 * formula, the same gap as M2-017's swap fees / slippage / gas estimate
 * (PROJECT_STATUS.md conflict #8) — itemized as `unavailableCosts` rather
 * than invented or silently omitted.
 */
export function calculateExitPosition(input: ExitPositionInput): FormulaResult<ExitPositionResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...input },
  };

  const { portfolio, targetDebt } = input;

  const currentCollateral = validateNonNegative(
    portfolio.collateral.quantity,
    'portfolio.collateral.quantity',
  );
  if (!currentCollateral.ok) return createFailure(currentCollateral.error, options);

  const currentDebt = validateNonNegative(portfolio.debt.balance, 'portfolio.debt.balance');
  if (!currentDebt.ok) return createFailure(currentDebt.error, options);

  const target = validateNonNegative(targetDebt, 'targetDebt');
  if (!target.ok) return createFailure(target.error, options);

  if (target.value.greaterThan(currentDebt.value)) {
    return createFailure(
      {
        code: 'INVALID_TARGET_DEBT',
        message:
          'targetDebt cannot exceed the portfolio’s current debt (an exit only repays debt).',
      },
      options,
    );
  }

  const scenarioPrice = input.scenarioBtcPriceUsd ?? portfolio.market.btcPriceUsd;
  const priceValidation = validatePrice(scenarioPrice, 'scenarioBtcPriceUsd');
  if (!priceValidation.ok) return createFailure(priceValidation.error, options);

  const repaymentResult = calculateRequiredDebtRepayment(portfolio.debt.balance, targetDebt);
  if (!repaymentResult.ok) return createFailure(repaymentResult.error, options);

  const btcSoldResult = calculateBtcSaleRequired(repaymentResult.value, scenarioPrice);
  if (!btcSoldResult.ok) return createFailure(btcSoldResult.error, options);

  const btcRetained = toDecimal(portfolio.collateral.quantity).minus(btcSoldResult.value);
  if (btcRetained.isNegative()) {
    return createFailure(
      {
        code: 'INSUFFICIENT_COLLATERAL',
        message: 'The portfolio does not hold enough BTC to complete this exit at the given price.',
      },
      options,
    );
  }

  const scenarioMarket = { btcPriceUsd: scenarioPrice };
  const retainedCollateral = {
    asset: portfolio.collateral.asset,
    quantity: toOutputNumber(btcRetained),
  };

  // retainedCollateral.quantity is already proven non-negative (checked
  // above), and scenarioMarket.btcPriceUsd was already validated; this
  // branch is unreachable given valid inputs, kept for defense in depth.
  const remainingCollateralValueResult = calculateCollateralValue(
    retainedCollateral,
    scenarioMarket,
  );
  if (!remainingCollateralValueResult.ok)
    return createFailure(remainingCollateralValueResult.error, options);

  const remainingPortfolio: PortfolioInput = {
    ...portfolio,
    collateral: retainedCollateral,
    debt: { asset: portfolio.debt.asset, balance: targetDebt },
    market: scenarioMarket,
  };

  const remainingEquityResult = calculateNetWorth(remainingPortfolio);
  if (!remainingEquityResult.ok) return createFailure(remainingEquityResult.error, options);

  const warnings: FormulaWarning[] = [
    ...repaymentResult.warnings,
    ...btcSoldResult.warnings,
    ...remainingCollateralValueResult.warnings,
    ...remainingEquityResult.warnings,
  ];

  return createSuccess(
    {
      repayment: repaymentResult.value,
      btcSold: btcSoldResult.value,
      btcRetained: toOutputNumber(btcRetained),
      remainingDebt: targetDebt,
      remainingCollateralValue: remainingCollateralValueResult.value,
      remainingEquity: remainingEquityResult.value,
      unavailableCosts: UNAVAILABLE_EXIT_COSTS,
    },
    options,
    warnings,
  );
}
