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
 */
import { calculatePortfolioGain } from '@/engine';
import type { ApplicationPortfolio, PortfolioActionPreview } from '@/services';
import { calculatePortfolioSummary } from '@/services';
import {
  formulaStep,
  optionsFromTracked,
  type TrackedFormulaVersion,
} from '@/services/shared/formulaStep';
import { createServiceSuccess, type ServiceResult } from '@/services/shared/result';

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

  const afterPortfolio: ApplicationPortfolio = {
    ...portfolio,
    collateral: {
      ...portfolio.collateral,
      quantity: portfolio.collateral.quantity + input.collateralDelta,
    },
    debt: { ...portfolio.debt, balance: portfolio.debt.balance + input.debtDelta },
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
    [...beforeResult.warnings, ...afterResult.warnings, ...gainStep.warnings],
  );
}
