/**
 * Exit Planning Service — 06_TASKS.md M3-011 ("Implement Exit Planning
 * Service"): "Coordinate full and partial exit planning." Include:
 * current portfolio baseline, target validation, exit calculations,
 * transaction assumptions, feasibility result, before-and-after
 * comparison. DoD: "Exit Planner components do not perform calculation
 * orchestration."
 *
 * **Revisiting conflicts #10 and #13 — both already resolved at the
 * Engine layer by scoping, not by inventing behavior; neither blocks
 * this Service.**
 *
 * Conflict #10 ("Target cash proceeds" has no unique execution order):
 * `calculateTargetExit`'s own `ExitTarget` union
 * (`debtBalance`/`healthFactor`/`retainedBtc`) already excludes "Target
 * cash proceeds" as a target type — that scoping decision was made at
 * M2-024, not deferred to this Service. `planExit` accepts `ExitTarget`
 * exactly as the Engine defines it, so it inherits the same, already-
 * documented target-type coverage. No new target type is invented here.
 *
 * Conflict #13 (F-040's Target Debt assumes fixed collateral, so a
 * `'healthFactor'` target undershoots once collateral is actually sold):
 * this is a known, already-tested Engine approximation
 * (`calculateTargetExit.ts`'s own code comment,
 * `targetHealthFactorInvariant.test.ts`), not a defect this Service
 * introduces or needs to correct. `planExit` calls `calculateTargetExit`
 * as-is and reports whatever Health Factor the "after" summary actually
 * computes — the discrepancy remains visible in the before/after
 * comparison exactly as it exists in the Engine, not hidden or
 * "corrected" with an undocumented equation.
 *
 * **"Current portfolio baseline" and "Before-and-after comparison" reuse
 * `calculatePortfolioSummary` (M3-005) directly**, called once on the
 * unmodified portfolio ("before") and once on the resulting post-exit
 * portfolio ("after") — the same pattern M3-006 and M3-009 already
 * established, applied a third time.
 *
 * **"Transaction assumptions"**: `calculateTargetExit`'s underlying
 * `calculateExitPosition` (M2-023) already itemizes `unavailableCosts`
 * (`swapFees`/`slippage`/`gasEstimate` — conflict #8's same pattern,
 * revisited and still not inventable). Passed through unchanged, not
 * dropped or fabricated.
 */
import { calculateTargetExit, type ExitTarget, type UnavailableExitCost } from '@/engine';

import { mapApplicationPortfolioToEngineInput } from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';
import { calculatePortfolioSummary, type PortfolioSummary } from '../portfolio/summary';
import { formulaStep, optionsFromTracked, type TrackedFormulaVersion } from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult, type ServiceWarning } from '../shared/result';

export interface ExitTransactionSummary {
  repayment: number;
  btcSold: number;
  btcRetained: number;
}

export interface ExitPlanResult {
  feasible: boolean;
  /** Present only when `feasible` is false — mirrors `TargetExitResult`'s own convention. */
  infeasibleReason?: string;
  before: PortfolioSummary;
  /** null when infeasible. */
  after: PortfolioSummary | null;
  /** null when infeasible. */
  transaction: ExitTransactionSummary | null;
  /** null when infeasible. */
  unavailableCosts: UnavailableExitCost[] | null;
}

/**
 * Plans a full or partial exit and returns a before/and-after comparison
 * — 06_TASKS.md M3-011. `sourceStatus` is caller-supplied for the same
 * reason as `calculatePortfolioSummary` (M3-005).
 */
export function planExit(
  portfolio: ApplicationPortfolio,
  target: ExitTarget,
  sourceStatus: string,
  scenarioBtcPriceUsd?: number,
): ServiceResult<ExitPlanResult> {
  const baselineResult = calculatePortfolioSummary(portfolio, sourceStatus);
  if (!baselineResult.ok) return baselineResult;

  const engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const warnings: ServiceWarning[] = [...baselineResult.warnings];
  let tracked: TrackedFormulaVersion = {
    engineVersion: baselineResult.metadata.engineVersion,
    formulaVersion: baselineResult.metadata.formulaVersion,
  };

  const exitStep = formulaStep(
    calculateTargetExit({ portfolio: engineInput, target, scenarioBtcPriceUsd }),
    tracked,
    sourceStatus,
  );
  if (!exitStep.ok) return exitStep.failure;
  tracked = exitStep.tracked;
  warnings.push(...exitStep.warnings);
  const targetExit = exitStep.value;

  if (!targetExit.feasible || targetExit.exit === null) {
    return createServiceSuccess(
      {
        feasible: false,
        infeasibleReason: targetExit.infeasibleReason,
        before: baselineResult.data,
        after: null,
        transaction: null,
        unavailableCosts: null,
      },
      optionsFromTracked(sourceStatus, tracked),
      warnings,
    );
  }

  const resolvedPrice = scenarioBtcPriceUsd ?? portfolio.market.btcPriceUsd;
  const afterPortfolio: ApplicationPortfolio = {
    collateral: { asset: portfolio.collateral.asset, quantity: targetExit.exit.btcRetained },
    debt: { asset: portfolio.debt.asset, balance: targetExit.exit.remainingDebt },
    market: { btcPriceUsd: resolvedPrice },
    protocol: portfolio.protocol,
  };

  const afterResult = calculatePortfolioSummary(afterPortfolio, sourceStatus);
  if (!afterResult.ok) return afterResult;
  warnings.push(...afterResult.warnings);

  return createServiceSuccess(
    {
      feasible: true,
      before: baselineResult.data,
      after: afterResult.data,
      transaction: {
        repayment: targetExit.exit.repayment,
        btcSold: targetExit.exit.btcSold,
        btcRetained: targetExit.exit.btcRetained,
      },
      unavailableCosts: targetExit.exit.unavailableCosts,
    },
    optionsFromTracked(sourceStatus, {
      engineVersion: afterResult.metadata.engineVersion,
      formulaVersion: afterResult.metadata.formulaVersion,
    }),
    warnings,
  );
}
