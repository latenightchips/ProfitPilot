import { calculateHealthFactor } from '../health/calculateHealthFactor';
import { toDecimal, toOutputNumber } from '../shared/decimal';
import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { ExecutionCostAssumptions, PortfolioInput } from '../shared/types';
import { checkTargetHealthFactorInvariant } from '../validation/invariants';
import {
  resolveEffectiveExecutionRate,
  validateNonNegative,
  validatePositive,
} from '../validation/validate';
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
  /**
   * Optional execution-cost friction assumptions (02_Formulas.md F-071,
   * V4 Readiness Audit §12 P1-5) — passed through to `calculateExitPosition`
   * once a target has resolved to a concrete `targetDebt`, AND consumed by
   * `resolveTargetDebt`'s own `healthFactor` closed-form solve below (via
   * the same shared `resolveEffectiveExecutionRate` helper), so the target
   * resolution and the actual frictioned sale agree on the same Effective
   * Rate. The `debtBalance` and `retainedBtc` target types do not need this
   * during resolution — `debtBalance` is already a concrete debt figure,
   * and `retainedBtc` resolves target debt directly from a BTC quantity, not
   * from a repayment amount computed under friction. Omitted (or both rates
   * zero) reproduces the pre-P1-5 frictionless behavior exactly, for every
   * target type.
   */
  executionCostAssumptions?: ExecutionCostAssumptions;
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
  executionCostAssumptions: ExecutionCostAssumptions | undefined,
): FormulaResult<number> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { portfolio, target, scenarioBtcPriceUsd, executionCostAssumptions },
  };

  if (target.type === 'debtBalance') {
    return createSuccess(target.targetDebt, options);
  }

  if (target.type === 'healthFactor') {
    const targetHf = validatePositive(target.targetHealthFactor, 'target.targetHealthFactor');
    if (!targetHf.ok) return createFailure(targetHf.error, options);

    const effectiveRate = resolveEffectiveExecutionRate(executionCostAssumptions);
    if (!effectiveRate.ok) return createFailure(effectiveRate.error, options);

    // Formerly reused F-040 "Target Debt" here (02_Formulas.md), which
    // assumes collateral stays fixed — wrong for an exit, which sells BTC
    // collateral to fund the very repayment being solved for (Conflict
    // #13, resolved). Since repayment R = debt0 - debt1 but, once F-071
    // execution friction applies to the BTC sale funding that repayment,
    // the BTC actually sold is R / (btcPrice x E) rather than R / btcPrice
    // (E = the shared F-070/F-071 Effective Rate — see
    // `resolveEffectiveExecutionRate`), remaining collateral value shrinks
    // by R / E, not by R itself. Substituting that into F-022's Health
    // Factor equation (02_Formulas.md):
    //   targetHF = (collateralValue0 - R / E) x LT / (debt0 - R)
    // and solving directly for R (self-financed, closed-form, no
    // iteration; independently re-derived and verified for V4 Readiness
    // Audit §12 P1-5's correction — it reduces exactly to the pre-P1-5
    // formula below when E = 1, the omitted/zero-assumptions case) gives:
    //   R = E x (targetHF x debt0 - LT x collateralValue0) / (E x targetHF - LT)
    // and debt1 = debt0 - R. `calculateTargetExit` (the only caller) already
    // rejects, as an infeasible data result, both targetHF <= LT (the
    // denominator would be <= 0 regardless of E, since E <= 1) and the
    // friction-specific case where a small enough E still drives
    // (E x targetHF - LT) to zero or negative even though targetHF > LT —
    // so the denominator here is guaranteed positive; the check below is
    // defense in depth only, not the primary rejection path.
    const collateralValue = toDecimal(portfolio.collateral.quantity).times(
      portfolio.market.btcPriceUsd,
    );
    const liquidationThreshold = toDecimal(portfolio.protocol.liquidationThreshold);
    const targetHfDecimal = toDecimal(targetHf.value);
    const debt0 = toDecimal(portfolio.debt.balance);

    const denominator = effectiveRate.value.times(targetHfDecimal).minus(liquidationThreshold);
    if (denominator.lessThanOrEqualTo(0)) {
      // Mathematically unreachable here: `calculateTargetExit` (the only
      // caller) already rejects any `healthFactor` target for which
      // (E x targetHF - liquidationThreshold) would be non-positive, as a
      // `feasible: false` data result rather than an error, before this
      // function ever runs — see its own pre-check. Kept for defense in
      // depth, the same "unreachable given already-validated inputs"
      // convention `resolveEffectiveExecutionRate` establishes above.
      return createFailure(
        {
          code: 'UNREACHABLE_NON_POSITIVE_TARGET_DENOMINATOR',
          message:
            'The friction-aware target Health Factor denominator was non-positive; this should have been rejected as infeasible before reaching this closed-form solve.',
        },
        options,
      );
    }

    const repaymentNumerator = effectiveRate.value.times(
      targetHfDecimal.times(debt0).minus(liquidationThreshold.times(collateralValue)),
    );
    const repayment = repaymentNumerator.dividedBy(denominator);
    const resolvedTargetDebt = debt0.minus(repayment);
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
 *
 * **`executionCostAssumptions` (V4 Readiness Audit §12 P1-5) frictions both
 * the final `calculateExitPosition` call AND, for the `healthFactor` target
 * type, `resolveTargetDebt`'s own closed-form solve above.** The
 * `healthFactor` branch resolves the repayment using the same F-071
 * Effective Rate that `calculateExitPosition` subsequently applies to the
 * actual BTC sale (via the shared `resolveEffectiveExecutionRate` helper —
 * no duplicated fee/slippage arithmetic), so the two agree by construction
 * rather than by coincidence. The post-hoc verification a few lines below
 * (the existing M2-027 tolerance/`checkTargetHealthFactorInvariant`
 * mechanism) is therefore expected to pass for any resolvable
 * `healthFactor` target, frictioned or not — it remains in place as a
 * defense-in-depth confirmation, not a documented source of false
 * negatives. Omitted (or both rates zero) reproduces the pre-P1-5
 * frictionless resolution exactly for every target type.
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
    // Below the pre-check: this remains a necessary (not sufficient) rejection
    // even once friction is considered. The friction-aware denominator is
    // (E x targetHF - liquidationThreshold), and E <= 1 always, so
    // targetHF <= liquidationThreshold implies E x targetHF <= liquidationThreshold
    // too — the denominator would be zero or negative regardless of E. (E can
    // ALSO drive the denominator non-positive even when targetHF exceeds the
    // liquidation threshold; that friction-specific case is checked inside
    // `resolveTargetDebt` itself, where the resolved Effective Rate is
    // available.)
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

  if (
    target.type === 'healthFactor' &&
    target.targetHealthFactor > portfolio.protocol.liquidationThreshold
  ) {
    // A friction-specific infeasibility class the H<=L pre-check above does
    // not catch: even with targetHF strictly above the liquidation
    // threshold, a small enough Effective Rate E (V4 Readiness Audit §12
    // P1-5) can still drive the friction-aware denominator
    // (E x targetHF - liquidationThreshold) to zero or negative, since
    // E <= 1 always. `resolveTargetDebt` computes the identical Effective
    // Rate for its own closed-form solve; this is checked here, before
    // that solve runs, so it is reported the same way every other
    // infeasible target is — as a `feasible: false` data result, not a
    // thrown error.
    const effectiveRate = resolveEffectiveExecutionRate(params.executionCostAssumptions);
    if (!effectiveRate.ok) return createFailure(effectiveRate.error, options);

    const denominator = effectiveRate.value
      .times(target.targetHealthFactor)
      .minus(portfolio.protocol.liquidationThreshold);
    if (denominator.lessThanOrEqualTo(0)) {
      return createSuccess(
        {
          feasible: false,
          infeasibleReason:
            'Under the supplied execution-cost assumptions, no self-financed repayment can reach the requested target Health Factor: execution friction reduces the effective collateral recovered per dollar of repayment enough that the target is unreachable, even though it exceeds the liquidation threshold.',
          resolvedTargetDebt: null,
          exit: null,
        },
        options,
      );
    }
  }

  const resolvedResult = resolveTargetDebt(
    portfolio,
    target,
    scenarioPrice,
    params.executionCostAssumptions,
  );
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
    executionCostAssumptions: params.executionCostAssumptions,
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
