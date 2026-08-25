import { calculateTotalExecutionCost } from '../execution/calculateTotalExecutionCost';
import { calculateTransactionGasCost } from '../execution/calculateTransactionGasCost';
import { calculateAnnualInterest } from '../interest/calculateAnnualInterest';
import {
  createFailure,
  createSuccess,
  type FormulaResult,
  type FormulaWarning,
} from '../shared/result';
import type { ExecutionCostAssumptions } from '../shared/types';
import { calculateBreakEvenAppreciation } from './calculateBreakEvenAppreciation';

const FORMULA_ID = 'F-037';
const FORMULA_VERSION = '1.0';

export interface LoopCostItem {
  item: 'swapFees' | 'slippage' | 'gasEstimate' | 'totalImplementationCost';
  /** The computed USD amount, once configured assumptions make this item computable. `null` while unavailable. */
  amountUsd: number | null;
  /** Present only when `amountUsd` is `null`. */
  reason?: string;
}

export interface LoopCostResult {
  /** Annual Interest — F-032, applied to the strategy's final debt. */
  borrowingInterest: number;
  /** Break-Even BTC Appreciation — F-037. */
  breakEvenAppreciation: number;
  /**
   * M2-017's "Swap fees / Slippage / Gas estimate / Total implementation
   * cost" cost items — each independently either a real computed USD
   * amount (V4 Readiness Audit §12 P1-6, once `execution` below supplies
   * what that item needs) or explicitly unavailable with a reason, never
   * a fabricated `$0`. Named `items`, not `costs`, so a caller reading
   * this off `LoopStrategyPreview.costs` (`services/loop/strategy.ts`)
   * never has to write the stutter `costs.costs`.
   */
  items: LoopCostItem[];
}

const SWAP_FEES_UNAVAILABLE_REASON =
  'No execution-cost assumptions are configured for this portfolio (Portfolio Details → Execution cost assumptions).';
const SLIPPAGE_UNAVAILABLE_REASON = SWAP_FEES_UNAVAILABLE_REASON;
const GAS_UNAVAILABLE_REASON =
  'No gas cost assumption is configured for this portfolio (Portfolio Details → Execution cost assumptions).';
const TOTAL_UNAVAILABLE_REASON =
  'Cannot be honestly totaled while swap fee/slippage and/or gas cost assumptions remain unconfigured.';

/**
 * Loop execution-cost inputs — V4 Readiness Audit §12 P1-6. Optional as a
 * whole: omitted reproduces the pre-P1-6 "always unavailable" behavior
 * exactly. `assumptions` and `gasCostPerTransactionUsd` are each
 * independently optional within it — see this stage's own ownership
 * report for why (a portfolio may configure gas without swap fee/
 * slippage, or vice versa).
 */
export interface LoopExecutionCostInputs {
  /** Total USD borrowed across every committed loop step — the same notional F-070 already applied friction to. */
  totalBorrowedUsd: number;
  /** Number of committed loop steps — this Engine's own explicit, product-chosen F-072 transaction count (see `calculateTransactionGasCost`'s own doc comment: never auto-derived inside that formula itself). */
  transactionCount: number;
  /** Present iff swap fee/slippage are configured for this portfolio. */
  assumptions?: ExecutionCostAssumptions;
  /** Present iff a gas cost assumption is configured for this portfolio. */
  gasCostPerTransactionUsd?: number;
}

/**
 * Loop Cost Calculations — 06_TASKS.md M2-017 (partial; "Include" list is
 * "Borrowing interest / Swap fees / Slippage / Gas estimate / Total
 * implementation cost / Break-even BTC appreciation").
 *
 * M2-017's declared dependency on M2-013 ("compound interest", blocked —
 * see PROJECT_STATUS.md) does not block "Borrowing interest" itself: that
 * sub-item is satisfied by the already-implemented simple-interest chain
 * (F-030-F-032, M2-012), not compound interest. This is flagged in
 * PROJECT_STATUS.md as a task-dependency-graph inconsistency rather than
 * silently ignored.
 *
 * **Swap fees / slippage / gas estimate / total implementation cost — V4
 * Readiness Audit §12 P1-6.** Before P1-5/P1-6, none of the four had a
 * Formula ID anywhere in `02_Formulas.md`, so this function unconditionally
 * itemized all four as unavailable. F-070–F-073 (P1-5) now exist; this
 * function composes them (`calculateTotalExecutionCost`/F-073,
 * `calculateTransactionGasCost`/F-072) rather than re-deriving any new
 * arithmetic. `execution` omitted (or every one of its optional sub-fields
 * omitted) reproduces the exact pre-P1-6 all-unavailable result — this is
 * a strict superset of the old behavior, not a replacement of it.
 *
 * **No-double-count**: the swap-fee/slippage cost reported here is the
 * SAME friction already subtracted once, during the strategy's own BTC
 * purchases (F-070) — `calculateTotalExecutionCost`'s own header comment
 * proves this identity. This function only surfaces that already-applied
 * cost as an explicit dollar figure; it never applies friction a second
 * time to `finalDebt`/`exposure`/`borrowingInterest` above, all of which
 * remain governed entirely by F-032/F-037 exactly as before.
 *
 * Tagged F-037 (Break-Even BTC Appreciation) as its primary Formula ID:
 * it is the only newly-introduced equation here; "Borrowing interest"
 * reuses F-032 and is documented per-field above.
 */
export function calculateLoopCosts(
  finalDebt: number,
  borrowApr: number,
  exposure: number,
  execution?: LoopExecutionCostInputs,
): FormulaResult<LoopCostResult> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { finalDebt, borrowApr, exposure, execution },
  };

  const annualInterestResult = calculateAnnualInterest(finalDebt, borrowApr);
  if (!annualInterestResult.ok) return createFailure(annualInterestResult.error, options);

  const breakEvenResult = calculateBreakEvenAppreciation(annualInterestResult.value, exposure);
  if (!breakEvenResult.ok) return createFailure(breakEvenResult.error, options);

  const warnings: FormulaWarning[] = [
    ...annualInterestResult.warnings,
    ...breakEvenResult.warnings,
  ];

  let swapFeeCostUsd: number | null = null;
  let slippageCostUsd: number | null = null;
  if (execution?.assumptions !== undefined) {
    // gasCostUsd fed as 0 here regardless of whether gas is separately
    // configured — F-073's own "No-Double-Count Invariant" shows the
    // swap-fee/slippage terms are computed independently of the gas term
    // before summing, so this cannot corrupt either figure; only the
    // function's own totalGasCostUsd/totalExecutionCostUsd outputs (both
    // discarded below in favor of the gas-specific/total branches, which
    // decide their own availability separately) would reflect it.
    const totalCostResult = calculateTotalExecutionCost(
      execution.totalBorrowedUsd,
      execution.assumptions,
      0,
    );
    if (!totalCostResult.ok) return createFailure(totalCostResult.error, options);
    swapFeeCostUsd = totalCostResult.value.swapFeeCostUsd;
    slippageCostUsd = totalCostResult.value.slippageCostUsd;
  }

  let gasCostUsd: number | null = null;
  if (execution?.gasCostPerTransactionUsd !== undefined) {
    const gasResult = calculateTransactionGasCost(
      execution.transactionCount,
      execution.gasCostPerTransactionUsd,
    );
    if (!gasResult.ok) return createFailure(gasResult.error, options);
    gasCostUsd = gasResult.value;
  }

  const totalImplementationCostUsd =
    swapFeeCostUsd !== null && slippageCostUsd !== null && gasCostUsd !== null
      ? swapFeeCostUsd + slippageCostUsd + gasCostUsd
      : null;

  const items: LoopCostItem[] = [
    swapFeeCostUsd !== null
      ? { item: 'swapFees', amountUsd: swapFeeCostUsd }
      : { item: 'swapFees', amountUsd: null, reason: SWAP_FEES_UNAVAILABLE_REASON },
    slippageCostUsd !== null
      ? { item: 'slippage', amountUsd: slippageCostUsd }
      : { item: 'slippage', amountUsd: null, reason: SLIPPAGE_UNAVAILABLE_REASON },
    gasCostUsd !== null
      ? { item: 'gasEstimate', amountUsd: gasCostUsd }
      : { item: 'gasEstimate', amountUsd: null, reason: GAS_UNAVAILABLE_REASON },
    totalImplementationCostUsd !== null
      ? { item: 'totalImplementationCost', amountUsd: totalImplementationCostUsd }
      : { item: 'totalImplementationCost', amountUsd: null, reason: TOTAL_UNAVAILABLE_REASON },
  ];

  return createSuccess(
    {
      borrowingInterest: annualInterestResult.value,
      breakEvenAppreciation: breakEvenResult.value,
      items,
    },
    options,
    warnings,
  );
}
