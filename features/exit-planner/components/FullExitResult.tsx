'use client';

import { formatCurrency } from '@/components/strategy/format';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Full Exit Result — 06_TASKS.md M7-024 ("Implement Full Exit Result").
 * Dependencies: M7-023. Priority P0, Effort M. Description: "Display
 * the result of fully closing the leveraged position." Include: "BTC
 * sold, Gross sale value, Debt repaid, Interest included, Transaction
 * costs, Net cash proceeds, Remaining collateral, Remaining debt." DoD:
 * "The full-exit result reconciles with current portfolio balances."
 *
 * **Renders only for a genuine full-exit RESULT (`after.debtValue ===
 * 0`), regardless of which of the 5 selectable exit types produced
 * it** — the same "one function, parameterized" distinction
 * `calculateExitPosition`'s own header comment already draws ("targetDebt:
 * 0 is a Full-exit result... any value between 0 and current debt is a
 * Partial-exit result"), applied here at the display layer instead of
 * gating on the UI's own `exitType` selection. A user reaching $0
 * remaining debt via "Partial Debt Repayment" (entering the exact
 * current balance) or "Target Debt Balance" (entering 0) produces the
 * same real full-exit outcome as selecting "Full Exit" directly — this
 * component shows the same content either way, honestly reflecting what
 * the Engine actually computed rather than what button was clicked.
 * `PartialExitResult.tsx` is the mutually-exclusive counterpart
 * (renders when `after.debtValue > 0`); `app/exit-planner/page.tsx`
 * owns the shared "not configured yet" / "infeasible" messaging once,
 * rather than duplicating it across both — see that route's own header
 * comment for why this is a deliberate deviation from
 * `app/loop-builder/page.tsx`'s own per-component-independence
 * precedent (Full/Partial are genuinely mutually exclusive views of the
 * *same* result, unlike Loop's simultaneously-shown independent
 * sections).
 *
 * **"Gross sale value" and "Debt repaid" are the same number, not two
 * independent calculations — reconciliation by construction, not
 * coincidence.** `calculateBtcSaleRequired` (F-042) solves BTC Sold
 * from Repayment ÷ Price, so selling exactly that BTC quantity at that
 * price always raises exactly the repayment amount — no leftover, no
 * shortfall. Displaying `transaction.repayment` under both labels *is*
 * M7-024's own DoD ("reconciles with current portfolio balances") made
 * visible, not a redundant duplicate row.
 *
 * **"Net cash proceeds" is a real, computed $0.00 — not "Not
 * available."** It follows directly from the same reconciliation above
 * (Gross Sale Value − Debt Repaid = 0): this Engine's model sells
 * exactly enough BTC to cover the target repayment, never more, so
 * there is structurally no leftover cash to report. A distinct "sell
 * extra, keep the difference as cash" mechanic is exactly what
 * PROJECT_STATUS.md Conflict #10 ("Target cash proceeds") describes as
 * unimplemented — cited here as the reason the figure is always zero,
 * not as a reason to hide it.
 *
 * **"Interest included" is interpreted as the Annual Interest Cost this
 * repayment eliminates** (`before.interestCost - after.interestCost`,
 * both already-computed `PortfolioSummary` fields, M3-005/F-031/F-032)
 * — the Exit chapter (F-040–F-042) has no interest-accrual formula of
 * its own to reuse, so this is a before/after delta of an existing
 * value, the same class of composition `StrategyComparison.tsx` already
 * performs for its own delta rows, not a new interest calculation.
 *
 * **"Transaction costs" reuses `unavailableCosts` (conflict #8) — same
 * itemized-unavailable convention `LoopCostAnalysis.tsx` already
 * established** for swap fees/slippage/gas estimate.
 *
 * **"Remaining collateral"/"Remaining debt"** read `transaction.btcRetained`
 * (BTC quantity) / `after.collateralValue` (USD) and `after.debtValue`
 * directly — both already-computed `ExitPlanResult` fields, never
 * recalculated.
 *
 * **A V4-only debt breakdown row (V4 Readiness Audit §12 Stage 25D)** —
 * see `PartialExitResult.tsx`'s own identical addition for the full
 * reasoning; a full exit clears both `drawnDebt`/`premiumDebt` to `0` via
 * the same real premium-first rule, itemized here for the same "prove
 * it, don't just assert it" reason.
 */
const UNAVAILABLE_COST_LABELS: Record<string, string> = {
  swapFees: 'Swap Fees',
  slippage: 'Slippage',
  gasEstimate: 'Gas Estimate',
};

export function FullExitResult() {
  const currentResult = useExitPlannerStore((state) => state.currentResult);

  if (
    currentResult === null ||
    !currentResult.feasible ||
    currentResult.after === null ||
    currentResult.transaction === null
  ) {
    return null;
  }
  if (currentResult.after.debtValue !== 0) {
    return null;
  }

  const { transaction, after, before, unavailableCosts } = currentResult;
  const interestEliminated = before.interestCost - after.interestCost;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h3 className="text-sm font-medium text-foreground">Full Exit Result</h3>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">BTC Sold</span>
        <span className="font-medium text-foreground">{transaction.btcSold.toFixed(8)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Gross Sale Value</span>
        <span className="font-medium text-foreground">{formatCurrency(transaction.repayment)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Debt Repaid</span>
        <span className="font-medium text-foreground">{formatCurrency(transaction.repayment)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Annual Interest Cost Eliminated</span>
        <span className="font-medium text-foreground">{formatCurrency(interestEliminated)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Net Cash Proceeds</span>
        <span className="font-medium text-foreground">{formatCurrency(0)}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Always $0.00 under this Engine&rsquo;s model — BTC sold is calibrated exactly to the
        requested repayment; a distinct &ldquo;sell extra, keep cash&rdquo; mechanic is not
        implemented (PROJECT_STATUS.md Conflict #10).
      </p>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Remaining Collateral</span>
        <span className="font-medium text-foreground">
          {transaction.btcRetained.toFixed(8)} BTC ({formatCurrency(after.collateralValue)})
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Remaining Debt</span>
        <span className="font-medium text-foreground">{formatCurrency(after.debtValue)}</span>
      </div>

      {transaction.v4DebtBreakdown && (
        <div className="flex flex-col gap-1 border-t border-border pt-2 text-xs">
          <span className="text-muted-foreground">
            Aave V4 Debt Breakdown (premium repaid first)
          </span>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Premium Debt</span>
            <span className="font-medium text-foreground">
              {formatCurrency(transaction.v4DebtBreakdown.before.premiumDebt)} →{' '}
              {formatCurrency(transaction.v4DebtBreakdown.after.premiumDebt)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Drawn Debt</span>
            <span className="font-medium text-foreground">
              {formatCurrency(transaction.v4DebtBreakdown.before.drawnDebt)} →{' '}
              {formatCurrency(transaction.v4DebtBreakdown.after.drawnDebt)}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <span className="text-muted-foreground">Transaction Costs</span>
        <dl className="flex flex-col gap-1 text-xs">
          {unavailableCosts?.map((entry) => (
            <div key={entry.item} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">
                {/* `?? entry.item` is type-system-provably unreachable —
                    UNAVAILABLE_COST_LABELS covers all 3 of
                    UnavailableExitCost['item']'s own literal values,
                    the same LoopCostAnalysis.tsx precedent. */}
                {UNAVAILABLE_COST_LABELS[entry.item] ?? entry.item}
              </dt>
              <dd className="text-right text-muted-foreground">Not itemized — {entry.reason}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
