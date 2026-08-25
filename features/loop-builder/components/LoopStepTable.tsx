'use client';

import { formatCurrency, formatHealthFactor, formatPercent } from '@/components/strategy/format';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Step Table — 06_TASKS.md M7-012 ("Implement Loop Step Table").
 * Dependencies: M7-010. Priority P0, Effort L. Columns: "Step number,
 * Borrow amount, BTC purchased, Collateral after resupply, Debt
 * balance, LTV, Health Factor, Cumulative cost." Include: "Compact
 * mobile representation, Expandable details." DoD: "Every final
 * strategy value can be traced through its individual steps."
 *
 * **7 of the 8 named columns map directly to `LoopStepRecord`'s own
 * already-computed fields** (`engine/loop/calculateLoopStep.ts`,
 * `engine/loop/calculateLoopStrategy.ts`) — Step number → `stepNumber`,
 * Borrow amount → `borrowedAmount`, BTC purchased → `btcPurchased`,
 * Collateral after resupply → `collateralAfter.quantity`, Debt balance
 * → `debtAfter`, LTV → `newLoanToValue`, Health Factor →
 * `newHealthFactor`. Zero recalculation — every cell reads a field the
 * Engine's own step math already produced.
 *
 * **"Cumulative cost" is honestly unavailable at the per-step grain, even
 * after conflict #8's resolution (V4 Readiness Audit §12 P1-6)** — no
 * `LoopStepRecord` field tracks a per-step dollar cost of any kind
 * (interest only begins accruing on the *final* debt after construction,
 * via `calculateLoopCosts`, not step by step; swap fee/slippage friction
 * IS applied per step, via F-070, but reduces that step's own
 * `btcPurchased` directly rather than surfacing a separate dollar
 * figure). The real, aggregate swap fee/slippage/gas dollar cost across
 * the whole strategy is computed once, at the strategy level
 * (`LoopCostAnalysis.tsx`'s own "Implementation Costs" section), not
 * per step — rather than fabricate a per-step running total this Engine
 * never computed, this column stays rendered with the same "not
 * included" wording, now describing a genuine per-step display gap
 * rather than a specification gap.
 *
 * **"Every final strategy value can be traced through its individual
 * steps" (DoD)**: `finalCollateral`/`finalDebt`/`finalHealthFactor` on
 * `LoopStrategyResult` are always numerically identical to the last
 * step's own `collateralAfter`/`debtAfter`/`newHealthFactor` — the
 * Engine's own `calculateLoopStrategy.ts` builds the final result
 * directly from the last step record, not a separate computation. This
 * table renders every step exactly as the Engine returned it, so that
 * identity is visible by construction, not asserted separately.
 *
 * **"Compact mobile representation"**: the table sits in its own
 * `overflow-x-auto` container — the same horizontal-scroll-within-its-
 * own-container pattern `ScenarioComparison.tsx` (M6-010) already
 * established and `responsiveLayout.spec.ts` already tests for that
 * component — rather than letting the whole page scroll. A full,
 * dedicated mobile layout pass is M7-039's own later, larger task
 * ("Implement Responsive Strategy Layouts," Batch 7); this satisfies
 * M7-012's own narrower Include item now, without pre-empting that
 * task's broader scope. `tabIndex={0}` on the wrapper (added Batch 7,
 * M7-040) fixes the same axe-core `scrollable-region-focusable`
 * violation `ExitPriceSensitivity.tsx`'s own header comment documents
 * finding on its own, newer `overflow-x-auto` wrapper — applied here
 * defensively, since this wrapper shares the identical structural risk.
 *
 * **"Expandable details"**: a native `<details>`/`<summary>` disclosure
 * per row, revealing `availableBorrow`/`loopCapital`/
 * `collateralValueAfter` — fields real, already computed, and already
 * documented on `LoopStepResult`, just not among the 8 named columns.
 * Native disclosure widgets are keyboard-operable and expose their own
 * expanded/collapsed state to assistive technology without any custom
 * ARIA wiring.
 */
export function LoopStepTable() {
  const currentResult = useLoopBuilderStore((state) => state.currentResult);

  if (currentResult === null || currentResult.strategy === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a viable strategy to see its individual steps.
      </p>
    );
  }

  const { steps } = currentResult.strategy;

  return (
    <div className="overflow-x-auto" tabIndex={0}>
      <table className="w-full min-w-[640px] text-sm">
        <caption className="sr-only">Loop strategy steps</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">
              Step
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Borrow Amount
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              BTC Purchased
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Collateral After Resupply
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Debt Balance
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              LTV
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Health Factor
            </th>
            <th scope="col" className="py-2 font-medium">
              Cumulative Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {steps.map((stepRecord) => (
            <tr key={stepRecord.stepNumber} className="border-b border-border/50 align-top">
              <td className="py-2 pr-3 text-foreground">
                <details>
                  <summary className="cursor-pointer">{stepRecord.stepNumber}</summary>
                  <dl className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <div className="flex gap-1">
                      <dt>Available Borrow:</dt>
                      <dd>{formatCurrency(stepRecord.availableBorrow)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Loop Capital:</dt>
                      <dd>{formatCurrency(stepRecord.loopCapital)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Collateral Value After:</dt>
                      <dd>{formatCurrency(stepRecord.collateralValueAfter)}</dd>
                    </div>
                  </dl>
                </details>
              </td>
              <td className="py-2 pr-3 text-foreground">
                {formatCurrency(stepRecord.borrowedAmount)}
              </td>
              <td className="py-2 pr-3 text-foreground">
                {stepRecord.btcPurchased.toFixed(6)} BTC
              </td>
              <td className="py-2 pr-3 text-foreground">
                {stepRecord.collateralAfter.quantity.toFixed(6)} BTC
              </td>
              <td className="py-2 pr-3 text-foreground">{formatCurrency(stepRecord.debtAfter)}</td>
              <td className="py-2 pr-3 text-foreground">
                {formatPercent(stepRecord.newLoanToValue)}
              </td>
              <td className="py-2 pr-3 text-foreground">
                {formatHealthFactor(stepRecord.newHealthFactor)}
              </td>
              <td className="py-2 text-xs text-muted-foreground">
                Fees, slippage, and gas not included
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
