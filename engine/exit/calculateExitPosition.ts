import { calculateTotalExecutionCost } from '../execution/calculateTotalExecutionCost';
import { calculateTransactionGasCost } from '../execution/calculateTransactionGasCost';
import { calculateCollateralValue } from '../portfolio/calculateCollateralValue';
import { calculateNetWorth } from '../portfolio/calculateNetWorth';
import { toDecimal, toOutputNumber } from '../shared/decimal';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';
import type { ExecutionCostAssumptions, PortfolioInput } from '../shared/types';
import { validateNonNegative, validatePrice } from '../validation/validate';
import { calculateBtcSaleRequired } from './calculateBtcSaleRequired';
import { calculateRequiredDebtRepayment } from './calculateRequiredDebtRepayment';

const FORMULA_ID = 'F-042';
const FORMULA_VERSION = '1.0';

/**
 * A single modeled exit transaction — one sell-and-repay action, per
 * V4 Readiness Audit §12 P1-6's own transaction-count decision (see
 * `calculateTransactionGasCost`'s/F-072's own doc comment: ProfitPilot is
 * a planner, not an execution engine, so this Engine never invents an
 * on-chain transaction architecture; the product layer decides the count
 * honestly instead). An exit is always exactly one modeled action here,
 * regardless of the actual number of on-chain transactions a real wallet
 * might submit.
 */
const EXIT_TRANSACTION_COUNT = 1;

export interface ExitCostItem {
  item: 'swapFees' | 'slippage' | 'gasEstimate' | 'totalImplementationCost';
  /** The computed USD amount, once configured assumptions make this item computable. `null` while unavailable. */
  amountUsd: number | null;
  /** Present only when `amountUsd` is `null`. */
  reason?: string;
}

const SWAP_FEES_UNAVAILABLE_REASON =
  'No execution-cost assumptions are configured for this portfolio (Portfolio Details → Execution cost assumptions).';
const SLIPPAGE_UNAVAILABLE_REASON = SWAP_FEES_UNAVAILABLE_REASON;
const GAS_UNAVAILABLE_REASON =
  'No gas cost assumption is configured for this portfolio (Portfolio Details → Execution cost assumptions).';
const TOTAL_UNAVAILABLE_REASON =
  'Cannot be honestly totaled while swap fee/slippage and/or gas cost assumptions remain unconfigured.';

export interface ExitPositionInput {
  portfolio: PortfolioInput;
  /** Debt remaining after the exit. 0 = full exit; any value in (0, currentDebt) = partial exit. */
  targetDebt: number;
  /** Optional scenario BTC price to execute the exit at — defaults to portfolio.market.btcPriceUsd. */
  scenarioBtcPriceUsd?: number;
  /**
   * Optional execution-cost friction assumptions (02_Formulas.md F-071,
   * V4 Readiness Audit §12 P1-5) — passed straight through to
   * `calculateBtcSaleRequired` for the sale-quantity leg, never
   * re-derived here. ALSO drives `costs` below (V4 Readiness Audit §12
   * P1-6): present (even both rates zero) means swap-fee/slippage cost
   * reporting is computed for real, using the SAME assumptions object,
   * so the friction already applied to `btcSold` and the dollar figures
   * reported for it can never disagree. Omitted reproduces the pre-P1-5
   * frictionless behavior exactly, and the pre-P1-6 always-unavailable
   * cost reporting exactly.
   */
  executionCostAssumptions?: ExecutionCostAssumptions;
  /**
   * Optional gas cost assumption, USD per modeled transaction (02_Formulas.md
   * F-072, V4 Readiness Audit §12 P1-6) — independently optional of
   * `executionCostAssumptions` above. An exit is always exactly one
   * modeled transaction (see `EXIT_TRANSACTION_COUNT`'s own comment).
   * Never applied to `btcSold`/`repayment`/`remainingDebt` — gas is
   * reporting-only, the same isolation F-072's own doc comment requires.
   */
  gasCostUsd?: number;
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
  /**
   * Exit transaction costs (02_Formulas.md conflict #8's own itemized
   * gap) — each independently either a real computed USD amount (V4
   * Readiness Audit §12 P1-6, once `executionCostAssumptions`/
   * `gasCostUsd` above supply what that item needs) or explicitly
   * unavailable with a reason, never a fabricated `$0`.
   */
  costs: ExitCostItem[];
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
 * Composes F-041 (Required Debt Repayment) and F-071 (BTC Sale Required
 * After Execution Friction — V4 Readiness Audit §12 P1-5, generalizing
 * F-042; `executionCostAssumptions` omitted reproduces F-042's own
 * frictionless equation exactly), then F-002 (Collateral Value) and F-004
 * (Net Equity) on the resulting retained-BTC / remaining-debt position —
 * satisfying "Remaining equity" and reconciling with current portfolio
 * balances per the DoD. "BTC quantity retained" (M2-023) is current
 * holdings minus BTC sold, a plain subtraction with no dedicated Formula
 * ID, computed directly. This function's own primary Formula ID stays
 * F-042 (the orchestration-level label for the whole operation, the same
 * "one primary ID for a composed function" convention `calculateLoopStep`
 * (F-014) already established) — only the internal BTC-sale sub-step's
 * own tag changed, from F-042 to F-071.
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
 * "Exit transaction costs" (M2-023's own Include list) had no documented
 * formula at conflict #8's original writing — F-072/F-073 (V4 Readiness
 * Audit §12 P1-5) now exist, so `costs` below computes each item for real
 * once the assumptions it needs are supplied (P1-6), and stays explicitly
 * itemized-as-unavailable otherwise, never invented or silently omitted.
 * `totalImplementationCost` is included alongside `swapFees`/`slippage`/
 * `gasEstimate` for consistency with `calculateLoopCosts`'s own item set
 * (F-037) — computing it costs nothing extra once the other three are
 * already being computed via the same shared `calculateTotalExecutionCost`
 * call.
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

  const btcSoldResult = calculateBtcSaleRequired(
    repaymentResult.value,
    scenarioPrice,
    input.executionCostAssumptions,
  );
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

  let swapFeeCostUsd: number | null = null;
  let slippageCostUsd: number | null = null;
  if (input.executionCostAssumptions !== undefined) {
    // gasCostUsd fed as 0 here regardless of whether gas is separately
    // configured — see `calculateLoopCosts`'s identical comment for why
    // this cannot corrupt either figure; only this call's own
    // totalGasCostUsd/totalExecutionCostUsd outputs (both discarded here)
    // would reflect it.
    const totalCostResult = calculateTotalExecutionCost(
      repaymentResult.value,
      input.executionCostAssumptions,
      0,
    );
    if (!totalCostResult.ok) return createFailure(totalCostResult.error, options);
    swapFeeCostUsd = totalCostResult.value.swapFeeCostUsd;
    slippageCostUsd = totalCostResult.value.slippageCostUsd;
  }

  let gasCostResolvedUsd: number | null = null;
  if (input.gasCostUsd !== undefined) {
    const gasResult = calculateTransactionGasCost(EXIT_TRANSACTION_COUNT, input.gasCostUsd);
    if (!gasResult.ok) return createFailure(gasResult.error, options);
    gasCostResolvedUsd = gasResult.value;
  }

  const totalImplementationCostUsd =
    swapFeeCostUsd !== null && slippageCostUsd !== null && gasCostResolvedUsd !== null
      ? swapFeeCostUsd + slippageCostUsd + gasCostResolvedUsd
      : null;

  const costs: ExitCostItem[] = [
    swapFeeCostUsd !== null
      ? { item: 'swapFees', amountUsd: swapFeeCostUsd }
      : { item: 'swapFees', amountUsd: null, reason: SWAP_FEES_UNAVAILABLE_REASON },
    slippageCostUsd !== null
      ? { item: 'slippage', amountUsd: slippageCostUsd }
      : { item: 'slippage', amountUsd: null, reason: SLIPPAGE_UNAVAILABLE_REASON },
    gasCostResolvedUsd !== null
      ? { item: 'gasEstimate', amountUsd: gasCostResolvedUsd }
      : { item: 'gasEstimate', amountUsd: null, reason: GAS_UNAVAILABLE_REASON },
    totalImplementationCostUsd !== null
      ? { item: 'totalImplementationCost', amountUsd: totalImplementationCostUsd }
      : { item: 'totalImplementationCost', amountUsd: null, reason: TOTAL_UNAVAILABLE_REASON },
  ];

  return createSuccess(
    {
      repayment: repaymentResult.value,
      btcSold: btcSoldResult.value,
      btcRetained: toOutputNumber(btcRetained),
      remainingDebt: targetDebt,
      remainingCollateralValue: remainingCollateralValueResult.value,
      remainingEquity: remainingEquityResult.value,
      costs,
    },
    options,
    warnings,
  );
}
