/**
 * Portfolio Action Simulation Service — 06_TASKS.md M6-008 ("Implement
 * Portfolio Action Simulation"). Dependencies: M6-004. Description:
 * "Simulate portfolio actions." Actions: "Add collateral, Withdraw
 * collateral, Borrow, Repay, Combined actions." DoD: "Users can
 * evaluate actions before applying them."
 *
 * **Reuses `calculatePortfolioSummary` (M3-005) directly — the same
 * "snapshot, apply change, snapshot again" pattern `previewPortfolioAction`
 * (M3-006, `services/portfolio/actionPreview.ts`) already established.**
 * Not built on top of `previewPortfolioAction` itself: that Service's
 * own `PortfolioAction` type is explicitly locked to exactly six named
 * variants "with no interface of its own... No extensibility fields or
 * inferred behavior beyond the six named actions, per instruction"
 * (`actionPreview.ts`'s own header comment) — extending it with a
 * seventh "combined" variant would violate that already-approved
 * constraint. This file is a small, separate, Simulation-only function
 * instead.
 *
 * **One function handles "Add collateral," "Withdraw collateral,"
 * "Borrow," "Repay," and "Combined actions" all at once** — each named
 * action is just one of `collateralDelta`/`debtDelta` being non-zero
 * while the other is `0`; "Combined actions" is simply both non-zero
 * simultaneously. `ScenarioBuilder.tsx`'s own Collateral Change/Debt
 * Change fields (M6-004, Batch 3 — built but left unwired specifically
 * for this task) already model both as one signed delta each, so no
 * separate "pick one action type" input is needed here either.
 *
 * **`profitOrLoss` added in Batch 9 (M6-009, "Implement Scenario
 * Summary")** — that task's own Display list names "Profit/Loss" as one
 * of 8 required fields, which the original `{ before, after }` shape
 * (reusing `PortfolioActionPreview`, `services/portfolio/actionPreview.ts`)
 * has no room for. Rather than widen that shared, already-locked type —
 * `previewPortfolioAction` (M3-006) is a different task's own Service
 * and has no Profit/Loss concept in its own contract — this file now
 * returns its own local `PortfolioActionSimulationResult` (a superset:
 * `{ before, after, profitOrLoss }`), only used within Simulation. The
 * value itself reuses `calculatePortfolioGain` (F-007), the exact same
 * already-public Engine function `services/simulation/scenario.ts`
 * already calls for price/interest scenarios — using collateral value
 * as "Current Value"/"Initial Investment", the same definition
 * `scenario.ts` established, not a new one invented here.
 *
 * **V4 debt-delta state (V4 Readiness Audit §12 Stage 11, resolved with a
 * real protocol-backed rule at Stage 12)** — `afterPortfolio` below
 * spreads `...portfolio`, so a V4 portfolio's `v4DebtState` previously
 * carried over completely UNCHANGED regardless of `input.debtDelta`:
 * since `mapApplicationPortfolioToEngineInput` reads canonical V4 debt
 * from `v4DebtState`, not `debt.balance`, a Borrow or Repay action's
 * effect on debt was silently invisible to the "after" summary for any
 * V4 portfolio. Fixed via `deriveV4DebtStateAfterDelta`
 * (`services/portfolio/mapping.ts`) — which now calls the real Engine
 * formula (`engine/protocols/aaveV4/deriveDebtAfterRepayment.ts`, Stage
 * 12) for ANY repay (partial or full), deterministically splitting the
 * amount between `drawnDebt`/`premiumDebt` (premium first, then drawn —
 * ported directly from `aave/aave-v4`'s own `calculateRestoreAmount`),
 * and returns a `FormulaStep` this file now composes exactly like every
 * other Engine call, propagating a failure instead of silently ignoring
 * it. A Borrow remains genuinely ambiguous (see that function's own doc
 * comment: it requires the user's full multi-collateral Risk Premium
 * recomputation, data this codebase's domain model has never captured)
 * and still fails closed via the existing Stage 9/10
 * `AAVE_V4_DEBT_STATE_MISSING` guard.
 */
import { calculatePortfolioGain } from '@/engine';
import type { ApplicationPortfolio, PortfolioActionPreview } from '@/services';
import { calculatePortfolioSummary } from '@/services';
import { deriveV4DebtStateAfterDelta } from '@/services/portfolio/mapping';
import type { AaveV4DebtState } from '@/services/portfolio/models';
import {
  formulaStep,
  optionsFromTracked,
  type TrackedFormulaVersion,
} from '@/services/shared/formulaStep';
import {
  createServiceSuccess,
  type ServiceResult,
  type ServiceWarning,
} from '@/services/shared/result';

export interface PortfolioActionSimulationInput {
  collateralDelta: number;
  debtDelta: number;
}

export interface PortfolioActionSimulationResult extends PortfolioActionPreview {
  profitOrLoss: number;
}

/**
 * Simulates a collateral and/or debt change against a portfolio and
 * returns the before/after summaries plus the resulting profit or loss
 * — `sourceStatus` is caller-supplied for the same reason as
 * `calculatePortfolioSummary` (M3-005): this Service has no source of
 * its own to report.
 */
export function simulatePortfolioAction(
  portfolio: ApplicationPortfolio,
  input: PortfolioActionSimulationInput,
  sourceStatus: string,
): ServiceResult<PortfolioActionSimulationResult> {
  const beforeResult = calculatePortfolioSummary(portfolio, sourceStatus);
  if (!beforeResult.ok) return beforeResult;

  const warnings: ServiceWarning[] = [...beforeResult.warnings];
  let afterV4DebtState: AaveV4DebtState | undefined;
  if (portfolio.protocolVersion === 'v4' && portfolio.v4DebtState !== undefined) {
    const v4DebtStateStep = deriveV4DebtStateAfterDelta(
      portfolio.v4DebtState,
      input.debtDelta,
      {
        engineVersion: beforeResult.metadata.engineVersion,
        formulaVersion: beforeResult.metadata.formulaVersion,
      },
      sourceStatus,
    );
    if (!v4DebtStateStep.ok) return v4DebtStateStep.failure;
    warnings.push(...v4DebtStateStep.warnings);
    afterV4DebtState = v4DebtStateStep.value;
  }

  const afterPortfolio: ApplicationPortfolio = {
    ...portfolio,
    collateral: {
      ...portfolio.collateral,
      quantity: portfolio.collateral.quantity + input.collateralDelta,
    },
    debt: { ...portfolio.debt, balance: portfolio.debt.balance + input.debtDelta },
    ...(portfolio.protocolVersion === 'v4' &&
      portfolio.v4DebtState !== undefined && { v4DebtState: afterV4DebtState }),
  };
  const afterResult = calculatePortfolioSummary(afterPortfolio, sourceStatus);
  if (!afterResult.ok) return afterResult;

  const tracked: TrackedFormulaVersion = {
    engineVersion: afterResult.metadata.engineVersion,
    formulaVersion: afterResult.metadata.formulaVersion,
  };

  const gainStep = formulaStep(
    calculatePortfolioGain(afterResult.data.collateralValue, beforeResult.data.collateralValue),
    tracked,
    sourceStatus,
  );
  if (!gainStep.ok) return gainStep.failure;

  return createServiceSuccess(
    { before: beforeResult.data, after: afterResult.data, profitOrLoss: gainStep.value },
    optionsFromTracked(sourceStatus, gainStep.tracked),
    [...warnings, ...afterResult.warnings, ...gainStep.warnings],
  );
}
