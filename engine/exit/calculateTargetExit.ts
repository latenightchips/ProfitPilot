import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { validateNonNegative, validatePositive } from '../validation/validate';
import { calculateExitPosition, type ExitPositionResult } from './calculateExitPosition';
import { calculateTargetDebt } from './calculateTargetDebt';

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

    const collateralValue = toDecimal(portfolio.collateral.quantity).times(
      portfolio.market.btcPriceUsd,
    );
    return calculateTargetDebt(
      toOutputNumber(collateralValue),
      portfolio.protocol.liquidationThreshold,
      target.targetHealthFactor,
    );
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
 * Each supported target type resolves to a "Target Debt" — reusing F-040
 * for `healthFactor`, and a direct algebraic inversion of F-041/F-042 for
 * `retainedBtc` (Repayment = BTC Sold × BTC Price, the same equation as
 * F-042 rearranged) — then delegates to `calculateExitPosition` (M2-023).
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

  const resolvedResult = resolveTargetDebt(portfolio, target, scenarioPrice);
  if (!resolvedResult.ok) return createFailure(resolvedResult.error, options);

  const resolvedTargetDebt = resolvedResult.value;

  if (resolvedTargetDebt < 0) {
    // A negative resolved target debt arises for a different reason per
    // target type, so it needs a type-specific message rather than one
    // generic one: for 'debtBalance' it is simply an invalid input; for
    // 'healthFactor' it is mathematically unreachable (F-040's equation
    // is always positive for valid, positive inputs — kept for defense
    // in depth); for 'retainedBtc' it means selling down to the
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
