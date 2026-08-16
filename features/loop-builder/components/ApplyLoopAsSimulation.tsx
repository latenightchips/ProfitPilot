'use client';

import Link from 'next/link';

import { formatHealthFactor } from '@/components/strategy/format';
import {
  type ApplicationPortfolio,
  buildFinalLoopPortfolio,
  resolveCanonicalDebtBalance,
} from '@/services';
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
 * portfolio's own current `collateral.quantity`/canonical current debt,
 * then passed to the already-public `runPortfolioActionSimulation`
 * (`stores/simulationStore.ts`, M6-008) unchanged. Zero new types, zero
 * Service/Engine changes.
 *
 * **`debtDelta` uses `resolveCanonicalDebtBalance` (V4 Readiness Audit
 * §12 Stage 16), not raw `debt.balance`.** `strategy.finalDebt` already
 * comes from `planLoopStrategy`, which itself resolves a V4 portfolio's
 * starting debt canonically (Stage 9/15) — subtracting the raw, possibly
 * stale legacy `debt.balance` from it would mix a canonical figure with a
 * non-canonical one and produce a wrong delta, silently misallocating the
 * resulting repay/borrow simulation for any V4 portfolio whose
 * `debt.balance` has drifted from its real synced total.
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
 *
 * **V4 dispatches to a structured path instead — V4 Readiness Audit §12
 * Stage 18, a real bug found and fixed, not a hypothetical.** The
 * `debtDelta`-based flow above always produced a POSITIVE delta for any
 * loop that actually adds leverage (the entire point of a loop), and
 * `services/simulation/portfolioAction.ts`'s own `deriveV4DebtStateAfterDelta`
 * call deliberately treats any positive V4 delta as "genuinely ambiguous"
 * and fails closed (Stage 11/12's own protocol-audited reasoning: a real
 * borrow triggers an on-chain Risk Premium refresh this codebase's
 * single-collateral domain model cannot recompute) — so `handleApply`
 * unconditionally failed for every real V4 loop, with no protocol-version
 * gating on the button to prevent a V4 user from hitting it.
 *
 * `currentResult.strategy` already has everything needed to build the
 * correct, structured "after" state directly — `buildFinalLoopPortfolio`
 * (`services/loop/finalPortfolio.ts`, Stage 17) already carries a real,
 * structured post-loop `v4DebtState` forward for a V4 portfolio (never a
 * bare scalar). For a V4 portfolio, `handleApply` now builds that final
 * portfolio directly and hands it to `runPortfolioTransitionSimulation`
 * (`stores/simulationStore.ts`, Stage 18) — which calls
 * `simulatePortfolioTransition`, comparing two already-known portfolio
 * snapshots without ever reducing the structured V4 state down to an
 * ambiguous scalar delta. **This does not weaken the fail-closed rule
 * for a generic, hand-entered V4 debt change** — `deriveV4DebtStateAfterDelta`
 * and `simulatePortfolioAction` are completely untouched, so
 * `ScenarioBuilder`'s own Debt Change field, `RecommendationDetailPanel`,
 * and `ApplyExitPlanAsSimulation` all still fail closed on a genuinely
 * ambiguous positive V4 delta exactly as before; only THIS component,
 * which already has the real structured state in hand rather than a bare
 * number, takes the other path.
 *
 * **V3 (or unset) is completely unchanged — a deliberate, explicit
 * dispatch, not a fallback.** `handleApply` branches on
 * `portfolio.protocolVersion === 'v4'` before doing anything; a V3
 * portfolio still computes `collateralDelta`/`debtDelta` and calls
 * `runPortfolioActionSimulation` exactly as it always has, on the exact
 * same code path, byte-for-byte — Stage 18 adds a new path for V4, it
 * does not touch V3's own.
 */
export function ApplyLoopAsSimulation({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const currentResult = useLoopBuilderStore((state) => state.currentResult);
  const portfolioActionPreview = useSimulationStore((state) => state.portfolioActionPreview);
  const runPortfolioActionSimulation = useSimulationStore(
    (state) => state.runPortfolioActionSimulation,
  );
  const runPortfolioTransitionSimulation = useSimulationStore(
    (state) => state.runPortfolioTransitionSimulation,
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

    if (portfolio.protocolVersion === 'v4') {
      const afterPortfolio = buildFinalLoopPortfolio(portfolio, currentResult.strategy);
      runPortfolioTransitionSimulation(portfolio, afterPortfolio);
      return;
    }

    const collateralDelta =
      currentResult.strategy.finalCollateral.quantity - portfolio.collateral.quantity;
    const debtDelta = currentResult.strategy.finalDebt - resolveCanonicalDebtBalance(portfolio);
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
