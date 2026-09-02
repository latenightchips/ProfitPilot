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
 *
 * **`simulatePortfolioTransition` (V4 Readiness Audit §12 Stage 18)** —
 * extracted, unchanged in behavior, from what `simulatePortfolioAction`
 * already did after building its own `afterPortfolio`: snapshot both
 * sides, diff. Exported so a caller that already has a complete,
 * correctly-built "after" `ApplicationPortfolio` in hand — the Loop
 * Builder's `buildFinalLoopPortfolio` (`services/loop/finalPortfolio.ts`),
 * which for a V4 portfolio already carries a real, structured
 * post-borrow `v4DebtState` forward, not a bare scalar — can reach the
 * same before/after/profitOrLoss comparison directly, without ever
 * reducing that structured state down to a `debtDelta` and back up
 * through `deriveV4DebtStateAfterDelta`'s deliberately ambiguous-borrow
 * fail-closed rule above. This function itself contains no
 * protocol-version branching at all: `calculatePortfolioSummary` (called
 * on each side) already dispatches V3 vs. V4 internally, exactly as it
 * always has — nothing here reinterprets a V3 field for V4 or vice
 * versa. `simulatePortfolioAction` itself is unchanged in every
 * observable way; this is a pure extraction, not a new behavior on the
 * existing delta-based path — see
 * `features/loop-builder/components/ApplyLoopAsSimulation.tsx`'s own
 * header comment for why the delta-based path stays V3's own unmodified
 * route while a V4 loop result now uses this one instead.
 */
import { calculatePortfolioGain } from '@/engine';
import type { ApplicationPortfolio, PortfolioActionPreview, PortfolioSummary } from '@/services';
import { calculatePortfolioSummary } from '@/services';
import { deriveV4DebtBalanceAfterDelta } from '@/services/portfolio/mapping';
import {
  formulaStep,
  optionsFromTracked,
  type TrackedFormulaVersion,
} from '@/services/shared/formulaStep';
import {
  createServiceSuccess,
  type ServiceFailure,
  type ServiceResult,
  type ServiceSuccess,
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
 * Builds the resulting "after" portfolio for a collateral/debt delta,
 * without computing any before/after comparison — extracted at V1.1
 * Batch 3 ("Apply to Portfolio") from `simulatePortfolioAction`'s own
 * inline construction, which now calls the same private step
 * (`buildAfterPortfolioStep` below) internally rather than duplicating
 * it. The one new external consumer is `services/portfolioApply`'s
 * Simulation and Exit Planner proposal builders: both features already
 * reduce their own result to exactly this `{collateralDelta, debtDelta}`
 * shape (Exit Planner via `-transaction.btcSold`/`-transaction.repayment`
 * — the same numbers `ApplyExitPlanAsSimulation.tsx` already uses), so
 * reusing this one function — rather than re-deriving
 * `deriveV4DebtStateAfterDelta`'s V4 fail-closed rule a second, subtly
 * different way — is what keeps "Apply to Portfolio" and "Apply as
 * Simulation" from ever silently disagreeing about what a given delta
 * produces.
 */
function buildAfterPortfolioStep(
  portfolio: ApplicationPortfolio,
  input: PortfolioActionSimulationInput,
  tracked: TrackedFormulaVersion,
  sourceStatus: string,
):
  | { ok: true; data: ApplicationPortfolio; warnings: ServiceWarning[] }
  | { ok: false; failure: ServiceFailure } {
  const collateral = {
    ...portfolio.collateral,
    quantity: portfolio.collateral.quantity + input.collateralDelta,
  };

  // V4 Edit-Time Debt Model Audit — `debt.balance` for a V4 portfolio is
  // NEVER computed as `portfolio.debt.balance + input.debtDelta` (the raw
  // stored field); it is always re-derived from the resulting
  // `v4DebtState` via the shared canonical chokepoint
  // (`deriveV4DebtBalanceAfterDelta`), so a portfolio whose raw
  // `debt.balance` had drifted from canonical self-heals here rather
  // than propagating the drift. See that function's own header comment.
  // This is the shared builder behind Simulation's, Exit Planner's, and
  // Recommendations' own "Apply to Portfolio" flows
  // (`services/portfolioApply/buildPortfolioActionApplyProposal.ts`).
  if (portfolio.protocolVersion === 'v4' && portfolio.v4DebtState !== undefined) {
    const step = deriveV4DebtBalanceAfterDelta(
      portfolio,
      portfolio.v4DebtState,
      input.debtDelta,
      tracked,
      sourceStatus,
    );
    if (!step.ok) return { ok: false, failure: step.failure };

    return {
      ok: true,
      data: {
        ...portfolio,
        collateral,
        debt: { ...portfolio.debt, balance: step.value.debtBalance },
        v4DebtState: step.value.v4DebtState,
      },
      warnings: step.warnings,
    };
  }

  // V3/unset — completely unchanged.
  return {
    ok: true,
    data: {
      ...portfolio,
      collateral,
      debt: { ...portfolio.debt, balance: portfolio.debt.balance + input.debtDelta },
    },
    warnings: [],
  };
}

export function buildPortfolioActionAfterPortfolio(
  portfolio: ApplicationPortfolio,
  input: PortfolioActionSimulationInput,
  sourceStatus: string,
): ServiceResult<ApplicationPortfolio> {
  const beforeResult = calculatePortfolioSummary(portfolio, sourceStatus);
  if (!beforeResult.ok) return beforeResult;

  const tracked: TrackedFormulaVersion = {
    engineVersion: beforeResult.metadata.engineVersion,
    formulaVersion: beforeResult.metadata.formulaVersion,
  };
  const step = buildAfterPortfolioStep(portfolio, input, tracked, sourceStatus);
  if (!step.ok) return step.failure;

  return createServiceSuccess(step.data, optionsFromTracked(sourceStatus, tracked), [
    ...beforeResult.warnings,
    ...step.warnings,
  ]);
}

/**
 * Computes the "after" summary against an already-computed "before"
 * result and diffs them. Not exported: callers always start from either
 * a portfolio (`simulatePortfolioTransition`) or one they already had to
 * compute anyway for other reasons (`simulatePortfolioAction`'s own
 * `tracked` metadata for its V4 delta step) — sharing this inner half
 * avoids computing `calculatePortfolioSummary` on the same "before"
 * portfolio twice (and double-counting its warnings) without forcing
 * every caller through the same public entry point.
 */
function compareAgainstBefore(
  beforeResult: ServiceSuccess<PortfolioSummary>,
  afterPortfolio: ApplicationPortfolio,
  sourceStatus: string,
): ServiceResult<PortfolioActionSimulationResult> {
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
    [...afterResult.warnings, ...gainStep.warnings],
  );
}

/**
 * Compares two already-fully-built portfolio snapshots — "before" and
 * "after" — and returns their summaries plus the resulting profit or
 * loss. V4 Readiness Audit §12 Stage 18: extracted from
 * `simulatePortfolioAction`'s own tail end, which now calls the shared
 * `compareAgainstBefore` half directly. No protocol-version branching
 * lives here — see this file's own header comment.
 */
export function simulatePortfolioTransition(
  before: ApplicationPortfolio,
  after: ApplicationPortfolio,
  sourceStatus: string,
): ServiceResult<PortfolioActionSimulationResult> {
  const beforeResult = calculatePortfolioSummary(before, sourceStatus);
  if (!beforeResult.ok) return beforeResult;

  const result = compareAgainstBefore(beforeResult, after, sourceStatus);
  if (!result.ok) return result;

  return { ...result, warnings: [...beforeResult.warnings, ...result.warnings] };
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

  const tracked: TrackedFormulaVersion = {
    engineVersion: beforeResult.metadata.engineVersion,
    formulaVersion: beforeResult.metadata.formulaVersion,
  };
  const step = buildAfterPortfolioStep(portfolio, input, tracked, sourceStatus);
  if (!step.ok) return step.failure;

  const result = compareAgainstBefore(beforeResult, step.data, sourceStatus);
  if (!result.ok) return result;

  return {
    ...result,
    warnings: [...beforeResult.warnings, ...step.warnings, ...result.warnings],
  };
}
