import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { checkTargetHealthFactorInvariant } from '../validation/invariants';
import { validateNonNegative, validatePositive } from '../validation/validate';
import { calculateExitPosition, type ExitPositionResult } from './calculateExitPosition';

const FORMULA_ID = 'F-040';
const FORMULA_VERSION = '1.0';

/**
 * A user-defined exit target — 06_TASKS.md M2-024's "Targets may
 * include" list, minus two items:
 *   - "Target BTC price" is not a standalone target here: `calculateExitPosition`
 *     (M2-023) already accepts an optional scenario price override, and
 *     06_TASKS.md's own later M7-021 (UI, read for context) does not list
 *     "Target BTC price" among its selectable exit *types* — only as an
 *     accompanying form field. See `calculateExitPosition`'s and
 *     PROJECT_STATUS.md's notes.
 *   - "Target cash proceeds" is not implemented — see PROJECT_STATUS.md;
 *     its mechanics (does it leave debt untouched, or repay debt first
 *     and keep the remainder?) are not determinable from the documented
 *     spec without guessing.
 */
export type ExitTarget =
  | { type: 'debtBalance'; targetDebt: number }
  | { type: 'healthFactor'; targetHealthFactor: number }
  | { type: 'retainedBtc'; targetRetainedBtc: number };

export interface TargetExitParams {
  portfolio: PortfolioInput;
  target: ExitTarget;
  scenarioBtcPriceUsd?: number;
}

export interface TargetExitResult {
  feasible: boolean;
  /** Present only when `feasible` is false. */
  infeasibleReason?: string;
  /** The debt balance the target resolves to. null when infeasible. */
  resolvedTargetDebt: number | null;
  /** null when infeasible. */
  exit: ExitPositionResult | null;
}

function resolveTargetDebt(
  portfolio: PortfolioInput,
  target: ExitTarget,
  scenarioBtcPriceUsd: number,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { portfolio, target, scenarioBtcPriceUsd },
  };

  if (target.type === 'debtBalance') {
    return createSuccess(target.targetDebt, options);
  }

  if (target.type === 'healthFactor') {
    const targetHf = validatePositive(target.targetHealthFactor, 'target.targetHealthFactor');
    if (!targetHf.ok) return createFailure(targetHf.error, options);

    // Formerly reused F-040 "Target Debt" here (02_Formulas.md), which
    // assumes collateral stays fixed — wrong for an exit, which sells BTC
    // collateral to fund the very repayment being solved for (Conflict
    // #13, resolved). Since repayment = debt0 - debt1 and btcSold x price
    // = repayment, selling collateral to repay debt shrinks remaining
    // collateral value by exactly the repayment amount. Substituting that
    // into F-022's Health Factor equation (02_Formulas.md):
    //   targetHF = (collateralValue0 - (debt0 - debt1)) x LT / debt1
    // and solving directly for debt1 (self-financed, closed-form, no
    // iteration) gives:
    //   debt1 = LT x (collateralValue0 - debt0) / (targetHF - LT)
    // The caller rejects targetHF <= liquidationThreshold before this
    // branch runs, since that makes the denominator zero or negative.
    const collateralValue = toDecimal(portfolio.collateral.quantity).times(
      portfolio.market.btcPriceUsd,
    );
    const liquidationThreshold = toDecimal(portfolio.protocol.liquidationThreshold);
    const numerator = liquidationThreshold.times(collateralValue.minus(portfolio.debt.balance));
    const denominator = toDecimal(targetHf.value).minus(liquidationThreshold);
    const resolvedTargetDebt = numerator.dividedBy(denominator);
    return createSuccess(toOutputNumber(resolvedTargetDebt), options);
  }

  // target.type === 'retainedBtc'
  const targetRetainedBtc = validateNonNegative(
    target.targetRetainedBtc,
    'target.targetRetainedBtc',
  );
  if (!targetRetainedBtc.ok) return createFailure(targetRetainedBtc.error, options);

  const btcSold = toDecimal(portfolio.collateral.quantity).minus(targetRetainedBtc.value);
  const repayment = btcSold.times(scenarioBtcPriceUsd);
  const resolvedTargetDebt = toDecimal(portfolio.debt.balance).minus(repayment);
  return createSuccess(toOutputNumber(resolvedTargetDebt), options);
}

/**
 * Target Exit Calculations — 06_TASKS.md M2-024 ("Implement Target Exit
 * Calculations").
 *
 * Each supported target type resolves to a "Target Debt" — a self-financed
 * closed-form solve of F-022's Health Factor equation for `healthFactor`
 * (see `resolveTargetDebt`; Conflict #13), and a direct algebraic
 * inversion of F-041/F-042 for `retainedBtc` (Repayment = BTC Sold × BTC
 * Price, the same equation as F-042 rearranged) — then delegates to
 * `calculateExitPosition` (M2-023). The resolved exit is then verified
 * against the requested target using the same F-022 Health Factor formula
 * and the M2-027 invariant tolerance, so `feasible: true` is only reported
 * once the actual resulting Health Factor reproduces the target.
 *
 * DoD ("the Engine reports when a requested target is mathematically
 * infeasible"): a target is infeasible when its resolved debt would fall
 * outside [0, current debt] — negative means the target implies *more*
 * debt than currently held (not achievable by an exit, which only repays
 * debt), and above current debt means no repayment is needed at all
 * (the target is already satisfied without selling anything, so it is
 * not describable as an "exit"). Infeasibility is reported as `ok: true`
 * with `feasible: false` and an explanatory reason — data, not a thrown
 * failure — the same convention `validateLoopStrategySafety` (M2-018)
 * established for "unsafe but well-formed" results.
 */
export function calculateTargetExit(params: TargetExitParams): FormulaResult<TargetExitResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio, target } = params;
  const scenarioPrice = params.scenarioBtcPriceUsd ?? portfolio.market.btcPriceUsd;

  if (target.type === 'retainedBtc' && target.targetRetainedBtc > portfolio.collateral.quantity) {
    return createSuccess(
      {
        feasible: false,
        infeasibleReason:
          'The requested retained BTC quantity exceeds the portfolio’s current holdings; an exit can only sell BTC, not acquire more.',
        resolvedTargetDebt: null,
        exit: null,
      },
      options,
    );
  }

  if (
    target.type === 'healthFactor' &&
    target.targetHealthFactor > 0 &&
    target.targetHealthFactor <= portfolio.protocol.liquidationThreshold
  ) {
    // Below the pre-check: selling collateral to fund repayment reduces
    // collateral value by exactly the amount it reduces debt, so the
    // resulting Health Factor can never fall to or below the liquidation
    // threshold via a self-financed exit — the self-financed equation's
    // denominator (targetHF - liquidationThreshold) would be zero or
    // negative here, which is rejected before it is ever evaluated.
    return createSuccess(
      {
        feasible: false,
        infeasibleReason:
          'The requested target Health Factor is at or below the liquidation threshold; selling collateral to fund the repayment reduces collateral value by the same amount as the debt it repays, so no self-financed exit can reach a target this low.',
        resolvedTargetDebt: null,
        exit: null,
      },
      options,
    );
  }

  const resolvedResult = resolveTargetDebt(portfolio, target, scenarioPrice);
  if (!resolvedResult.ok) return createFailure(resolvedResult.error, options);

  const resolvedTargetDebt = resolvedResult.value;

  if (resolvedTargetDebt < 0) {
    // A negative resolved target debt arises for a different reason per
    // target type, so it needs a type-specific message rather than one
    // generic one: for 'debtBalance' it is simply an invalid input; for
    // 'healthFactor' this is only reachable when the current position is
    // already at or under the liquidation threshold (current collateral
    // value <= current debt) — kept for defense in depth, since the
    // targetHF <= liquidationThreshold case is already rejected above;
    // for 'retainedBtc' it means selling down to the
    // requested retained quantity would generate more cash than needed
    // to fully repay debt, which is "Target cash proceeds" territory —
    // not implemented, see PROJECT_STATUS.md.
    const infeasibleReason =
      target.type === 'debtBalance'
        ? 'Target debt balance cannot be negative.'
        : target.type === 'retainedBtc'
          ? 'This target would generate more cash than needed to fully repay debt; representing leftover cash proceeds beyond full repayment is not implemented — see PROJECT_STATUS.md.'
          : 'The resolved target debt is negative.';
    return createSuccess(
      { feasible: false, infeasibleReason, resolvedTargetDebt: null, exit: null },
      options,
    );
  }

  if (resolvedTargetDebt > portfolio.debt.balance) {
    // Only reachable for 'debtBalance' and 'healthFactor': a 'retainedBtc'
    // target already had targetRetainedBtc <= current holdings verified
    // above, which guarantees btcSold >= 0 and therefore
    // resolvedTargetDebt <= current debt.
    return createSuccess(
      {
        feasible: false,
        infeasibleReason:
          'The requested target requires more debt than the portfolio currently holds; an exit can only repay debt, not add it.',
        resolvedTargetDebt: null,
        exit: null,
      },
      options,
    );
  }

  const exitResult = calculateExitPosition({
    portfolio,
    targetDebt: resolvedTargetDebt,
    scenarioBtcPriceUsd: scenarioPrice,
  });
  if (!exitResult.ok) return createFailure(exitResult.error, options);

  if (target.type === 'healthFactor') {
    // Post-hoc verification (Conflict #13 fix): confirm the actual
    // resulting state reproduces the requested target, using the same
    // F-022 Health Factor formula the UI displays as "Resulting Health
    // Factor" and the same M2-027 invariant tolerance already established
    // for this exact relationship elsewhere in the Engine
    // (`checkTargetHealthFactorInvariant`). `feasible: true` must not be
    // reported unless this holds.
    const resultingHf = calculateHealthFactor(
      exitResult.value.remainingCollateralValue,
      portfolio.protocol.liquidationThreshold,
      exitResult.value.remainingDebt,
    );
    if (!resultingHf.ok) return createFailure(resultingHf.error, options);

    if (!checkTargetHealthFactorInvariant(resultingHf.value, target.targetHealthFactor)) {
      return createSuccess(
        {
          feasible: false,
          infeasibleReason: `The resolved exit produces a Health Factor of ${resultingHf.value}, not the requested target of ${target.targetHealthFactor}, within tolerance.`,
          resolvedTargetDebt: null,
          exit: null,
        },
        options,
      );
    }
  }

  return createSuccess(
    {
      feasible: true,
      resolvedTargetDebt,
      exit: exitResult.value,
    },
    options,
    exitResult.warnings,
  );
}
