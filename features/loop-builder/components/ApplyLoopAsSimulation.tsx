'use client';

import Link from 'next/link';

import { formatHealthFactor } from '@/components/strategy/format';
import { type ApplicationPortfolio } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { useSimulationStore } from '@/stores/simulationStore';

import { stopReasonLabel } from '../utils/stopReasonLabel';

/**
 * Apply Loop as Simulation — 06_TASKS.md M7-016 ("Implement Apply Loop
 * as Simulation"). Dependencies: M7-010, M6-003. Priority P1, Effort M.
 * Description: "Let users preview a loop as a Simulation Workspace
 * position-change scenario." DoD: "Loop strategies integrate with the
 * broader Simulation Workspace." M7-016 flagged an unresolved
 * architectural question at planning time (whether to extend
 * `SimulationScenario`'s own `{price}|{interest}` union, or reuse
 * something else); resolved here per explicit instruction to prefer an
 * existing architectural fit over inventing a new abstraction.
 *
 * **Resolution: reuse the already-existing
 * `PortfolioActionSimulationInput` (`{collateralDelta, debtDelta}`,
 * `services/simulation/portfolioAction.ts`, M6-008) — not
 * `SimulationScenario`.** `SimulationScenario`'s two variants
 * (`{type:'price'}`/`{type:'interest'}`) both represent "what if the
 * market moves," a hypothetical external change applied *to* a fixed
 * position — they cannot represent "the fixed final state of an
 * already-computed loop" without inventing a third variant with a
 * different meaning than the other two, which is exactly the kind of
 * new abstraction the resolution instruction says to avoid.
 * `PortfolioActionSimulationInput` already means "a deliberate change
 * to collateral and/or debt," which is precisely what a loop's own
 * final state versus the current portfolio is — `collateralDelta`/
 * `debtDelta` are computed here as the difference between
 * `strategy.finalCollateral.quantity`/`finalDebt` and the active
 * portfolio's own current `collateral.quantity`/`debt.balance`, then
 * passed to the already-public `runPortfolioActionSimulation`
 * (`stores/simulationStore.ts`, M6-008) unchanged. Zero new types, zero
 * Service/Engine changes.
 *
 * **This is the one deliberate, narrow exception within
 * `features/loop-builder/**` that imports `useSimulationStore`.**
 * `stores/loopBuilderStore.ts`'s own independence DoD ("Loop strategy
 * state remains independent from portfolio and simulation state")
 * constrains that Store file itself, not every component in this
 * feature — cross-Store wiring belongs at the UI layer, the same
 * precedent `app/loop-builder/page.tsx` already established by
 * importing both `useLoopBuilderStore` and `usePortfolioStore`. This
 * component is UI, not Store code, and its entire purpose (per its own
 * task name) is bridging the two features.
 */
export function ApplyLoopAsSimulation({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const currentResult = useLoopBuilderStore((state) => state.currentResult);
  const portfolioActionPreview = useSimulationStore((state) => state.portfolioActionPreview);
  const runPortfolioActionSimulation = useSimulationStore(
    (state) => state.runPortfolioActionSimulation,
  );

  if (currentResult === null || currentResult.strategy === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a viable strategy to apply it as a simulation.
      </p>
    );
  }

  const { strategy } = currentResult;

  function handleApply() {
    if (currentResult === null || currentResult.strategy === null) return;
    const collateralDelta =
      currentResult.strategy.finalCollateral.quantity - portfolio.collateral.quantity;
    const debtDelta = currentResult.strategy.finalDebt - portfolio.debt.balance;
    runPortfolioActionSimulation(portfolio, { collateralDelta, debtDelta });
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Apply this loop&apos;s final collateral and debt as a position-change scenario in the
        Simulation Workspace, without re-entering any numbers.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleApply}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Apply Loop as Simulation
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
          Stop Reason: {stopReasonLabel(strategy.stopReason)}.
        </p>
      )}
    </div>
  );
}
