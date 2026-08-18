'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { formatHealthFactor } from '@/components/strategy/format';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Apply Exit Plan as Simulation — a real gap found during Milestone 7
 * Batch 8's own M7-044 ("Create Cross-Tool Workflow Tests"), not a
 * pre-existing task. M7-044's own "Flows" list names "Copy an exit plan
 * into a simulation" as a connected strategy workflow to test — but no
 * task from M7-019 through M7-030 (Exit Planner's own full task range)
 * ever built the underlying bridge, unlike Loop Builder's symmetric
 * `ApplyLoopAsSimulation.tsx` (M7-016). A cross-tool *test* cannot cover
 * a workflow that does not exist, so this component is the minimal,
 * justified addition needed to make M7-044's own named flow real —
 * built by reusing already-existing infrastructure, not inventing any.
 *
 * **Reuses the exact same bridge `ApplyLoopAsSimulation.tsx` already
 * established: `PortfolioActionSimulationInput` (`{collateralDelta,
 * debtDelta}`, `services/simulation/portfolioAction.ts`, M6-008), not a
 * new mechanism.** An exit plan's own already-computed
 * `ExitPlanResult.transaction` (`services/exit/plan.ts`, M3-011)
 * directly gives both deltas: `transaction.btcSold` is exactly how much
 * collateral the exit sells (a negative `collateralDelta`), and
 * `transaction.repayment` is exactly how much debt it repays (a
 * negative `debtDelta`) — F-041/F-042's own already-computed outputs,
 * not a new calculation. Passed to the already-public
 * `runPortfolioActionSimulation` (`stores/simulationStore.ts`)
 * unchanged. Zero new types, zero Service/Engine changes.
 *
 * **This is the one deliberate, narrow exception within
 * `features/exit-planner/**` that imports `useSimulationStore`** — the
 * same "cross-Store wiring belongs at the UI layer" precedent
 * `ApplyLoopAsSimulation.tsx`'s own header comment already establishes.
 * `stores/exitPlannerStore.ts` itself is untouched, keeping its own
 * independence DoD intact.
 *
 * **"Applied — ..." reads a local snapshot, not a reactive
 * `portfolioActionPreview` subscription (V4 Readiness Audit §12 Stage 25
 * follow-up)** — see `handleApply`'s own comment below for the real bug
 * this closes: the shared Simulation Store's `portfolioActionPreview`
 * can hold a result from an entirely different apply (a prior exit
 * attempt, a Loop Builder apply, Simulation's own Portfolio Action),
 * which a reactive read would show mixed with this render's always-fresh
 * `transaction.btcSold` — a real, reproduced stale-Health-Factor bug.
 * `ApplyLoopAsSimulation.tsx` has the identical reactive-read pattern and
 * is very likely susceptible to the same bug, but was out of this
 * specific fix's reported scope — not fixed here.
 */
export function ApplyExitPlanAsSimulation({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const currentResult = useExitPlannerStore((state) => state.currentResult);
  const runPortfolioActionSimulation = useSimulationStore(
    (state) => state.runPortfolioActionSimulation,
  );
  // Stage 25D — local snapshot of what THIS button actually applied, not
  // a reactive read of the global `useSimulationStore.portfolioActionPreview`.
  // That Store is shared across Simulation's own Portfolio Action feature,
  // `features/loop-builder/components/ApplyLoopAsSimulation.tsx`, and this
  // component — reading it reactively meant "Applied — Health Factor
  // X, Y BTC sold" could show a stale Health Factor left over from a
  // completely different apply (an earlier exit-plan attempt, a Loop
  // Builder apply, or the Simulation page's own Portfolio Action), mixed
  // with THIS render's always-fresh `transaction.btcSold` — a real,
  // reproduced bug (V4 Readiness Audit §12 Stage 25 follow-up). Snapshotting
  // both values together, only at the moment `handleApply` actually runs,
  // means the message can never show a Health Factor that didn't come from
  // applying the transaction currently on screen.
  const [appliedResult, setAppliedResult] = useState<{
    healthFactor: number;
    btcSoldFormatted: string;
  } | null>(null);

  const transactionBtcSold = currentResult?.transaction?.btcSold;
  const transactionRepayment = currentResult?.transaction?.repayment;

  // Clears a previously-applied confirmation the moment the underlying
  // exit transaction changes (e.g. the user edits the repayment amount
  // or target after applying) — an "Applied" message must never survive
  // referring to numbers that are no longer what's displayed.
  useEffect(() => {
    setAppliedResult(null);
  }, [transactionBtcSold, transactionRepayment]);

  if (currentResult === null || !currentResult.feasible || currentResult.transaction === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a feasible exit target to apply it as a simulation.
      </p>
    );
  }

  function handleApply() {
    // Unreachable in practice — this button only renders past the
    // early-return guard above, which already proves both non-null.
    // Kept as a defensive re-check, the same precedent
    // `ApplyLoopAsSimulation.tsx`'s own `handleApply` already
    // establishes for the identical shape.
    if (currentResult === null || currentResult.transaction === null) return;
    const { btcSold, repayment } = currentResult.transaction;
    runPortfolioActionSimulation(portfolio, {
      collateralDelta: -btcSold,
      debtDelta: -repayment,
    });
    // Synchronous store action (`stores/simulationStore.ts`) — reading
    // `getState()` immediately after it returns the fresh result, not a
    // stale one, without subscribing this component to the Store's own
    // reactive updates (see this component's own header note above).
    const preview = useSimulationStore.getState().portfolioActionPreview;
    setAppliedResult(
      preview !== null
        ? { healthFactor: preview.after.healthFactor, btcSoldFormatted: btcSold.toFixed(6) }
        : null,
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Apply this exit plan&apos;s resulting collateral and debt as a position-change scenario in
        the Simulation Workspace, without re-entering any numbers.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleApply}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Apply Exit Plan as Simulation
        </button>
        <Link
          href="/simulation"
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Open Simulation Workspace
        </Link>
      </div>
      {appliedResult !== null && (
        <p role="status" className="text-xs text-muted-foreground">
          Applied — Health Factor {formatHealthFactor(appliedResult.healthFactor)},{' '}
          {appliedResult.btcSoldFormatted} BTC sold.
        </p>
      )}
    </div>
  );
}
