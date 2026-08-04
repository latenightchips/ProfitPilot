'use client';

import Link from 'next/link';

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
 */
export function ApplyExitPlanAsSimulation({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const currentResult = useExitPlannerStore((state) => state.currentResult);
  const portfolioActionPreview = useSimulationStore((state) => state.portfolioActionPreview);
  const runPortfolioActionSimulation = useSimulationStore(
    (state) => state.runPortfolioActionSimulation,
  );

  if (currentResult === null || !currentResult.feasible || currentResult.transaction === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a feasible exit target to apply it as a simulation.
      </p>
    );
  }

  const { transaction } = currentResult;

  function handleApply() {
    // Unreachable in practice — this button only renders past the
    // early-return guard above, which already proves both non-null.
    // Kept as a defensive re-check, the same precedent
    // `ApplyLoopAsSimulation.tsx`'s own `handleApply` already
    // establishes for the identical shape.
    if (currentResult === null || currentResult.transaction === null) return;
    runPortfolioActionSimulation(portfolio, {
      collateralDelta: -currentResult.transaction.btcSold,
      debtDelta: -currentResult.transaction.repayment,
    });
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
      {portfolioActionPreview !== null && (
        <p role="status" className="text-xs text-muted-foreground">
          Applied — Health Factor {formatHealthFactor(portfolioActionPreview.after.healthFactor)},
          {transaction.btcSold.toFixed(6)} BTC sold.
        </p>
      )}
    </div>
  );
}
