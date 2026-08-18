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
 *
 * **V4 post-exit state (V4 Readiness Audit §12 Stage 11, resolved with a
 * real protocol-backed rule at Stage 12)** — `afterPortfolio` below
 * previously dropped `protocolVersion`/`v4Position`/`v4DebtState`
 * entirely, constructing a bare V3-shaped record even for a V4 exit; the
 * "after" summary then silently used V3 math instead of failing or
 * reporting real V4 state. Fixed by preserving `protocolVersion`/
 * `v4Position` unconditionally (real identity, not invented — the on-chain
 * position doesn't change protocol version or wallet address just because
 * a repayment happened) and deriving the post-repayment `v4DebtState` via
 * `deriveV4DebtStateAfterDelta` (`services/portfolio/mapping.ts`) — which
 * now calls the real Engine formula
 * (`engine/protocols/aaveV4/deriveDebtAfterRepayment.ts`, Stage 12) ported
 * directly from `aave/aave-v4`'s own `calculateRestoreAmount`: premium
 * debt is repaid first, then drawn debt with the remainder, a fully
 * deterministic split for ANY repayment amount (partial or full), not
 * just the full-exit case Stage 11 could resolve on its own. A V4
 * *borrow* remains genuinely ambiguous (see that function's own doc
 * comment) and still returns `undefined`, which
 * `calculatePortfolioSummary`'s existing Stage 9/10 guard turns into a
 * `ServiceFailure` (`AAVE_V4_DEBT_STATE_MISSING`) below — Exit Plan never
 * borrows, so this only matters if a future caller ever does, and even
 * then this Service still fails closed rather than guessing.
 */
import { calculateTargetExit, type ExitTarget, type UnavailableExitCost } from '@/engine';

import {
  deriveV4DebtStateAfterDelta,
  mapApplicationPortfolioToEngineInput,
  resolveRiskCapacityFraction,
} from '../portfolio/mapping';
import type { AaveV4DebtState, ApplicationPortfolio } from '../portfolio/models';
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

  // V4 Readiness Audit §12 Stage 23E — `calculateTargetExit`'s
  // `'healthFactor'` target type reads `portfolio.protocol.liquidationThreshold`
  // directly inside its own Engine formula (`engine/exit/calculateTargetExit.ts`'s
  // `resolveTargetDebt`), a V3-shaped assumption Stage 23D didn't reach
  // (it only wired `summary.ts`/`scenario.ts`/`borrowCapacity.ts`).
  // `baselineResult.ok` above already proves `calculatePortfolioSummary`
  // passed its own `checkAaveV4CollateralRiskAvailable` guard for this
  // exact portfolio, so no separate guard call is needed here (the same
  // "guard inherited for free" pattern `services/simulation/scenario.ts`
  // already established). The dispatched value is substituted into the
  // SAME `PortfolioInput.protocol.liquidationThreshold` slot the Engine
  // function reads generically — never modifying the Engine, never
  // permanently redefining what `protocol.liquidationThreshold` means on
  // the persisted portfolio. Inert for `'debtBalance'`/`'retainedBtc'`
  // targets, which never read this field (confirmed by reading
  // `calculateTargetExit.ts`/`calculateExitPosition.ts` in full — no
  // other function in this call chain reads `.protocol` at all).
  const riskCapacityFraction = resolveRiskCapacityFraction(portfolio)!;
  const dispatchedEngineInput = {
    ...engineInput,
    protocol: { ...engineInput.protocol, liquidationThreshold: riskCapacityFraction },
  };

  const exitStep = formulaStep(
    calculateTargetExit({ portfolio: dispatchedEngineInput, target, scenarioBtcPriceUsd }),
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

  let afterV4DebtState: AaveV4DebtState | undefined;
  if (portfolio.protocolVersion === 'v4' && portfolio.v4DebtState !== undefined) {
    const v4DebtStateStep = deriveV4DebtStateAfterDelta(
      portfolio.v4DebtState,
      -targetExit.exit.repayment,
      tracked,
      sourceStatus,
    );
    if (!v4DebtStateStep.ok) return v4DebtStateStep.failure;
    tracked = v4DebtStateStep.tracked;
    warnings.push(...v4DebtStateStep.warnings);
    afterV4DebtState = v4DebtStateStep.value;
  }

  const resolvedPrice = scenarioBtcPriceUsd ?? portfolio.market.btcPriceUsd;
  const afterPortfolio: ApplicationPortfolio = {
    collateral: { asset: portfolio.collateral.asset, quantity: targetExit.exit.btcRetained },
    debt: { asset: portfolio.debt.asset, balance: targetExit.exit.remainingDebt },
    market: { btcPriceUsd: resolvedPrice },
    protocol: portfolio.protocol,
    ...(portfolio.protocolVersion !== undefined && { protocolVersion: portfolio.protocolVersion }),
    ...(portfolio.v4Position !== undefined && { v4Position: portfolio.v4Position }),
    ...(afterV4DebtState !== undefined && { v4DebtState: afterV4DebtState }),
    // V4 Readiness Audit §12 Stage 23D — an exit/repayment changes debt,
    // never the collateral-risk config itself (Stage 23B: collateralFactor
    // is bound to the reserve's dynamic-config snapshot, not touched by
    // repay), so this carries the real synced value forward unchanged,
    // the same "carry real state forward, never invent it" rule
    // `v4Position` above already follows. Without this, `afterResult`
    // below would fail closed on AAVE_V4_COLLATERAL_RISK_MISSING for a
    // V4 exit even when the portfolio's collateral risk was fully synced.
    ...(portfolio.v4CollateralRisk !== undefined && {
      v4CollateralRisk: portfolio.v4CollateralRisk,
    }),
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
