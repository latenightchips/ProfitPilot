'use client';

import { formatCurrency, formatHealthFactor } from '@/components/strategy/format';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Partial Exit Result — 06_TASKS.md M7-025 ("Implement Partial Exit
 * Result"). Dependencies: M7-023. Priority P0, Effort L. Description:
 * "Display partial-exit outcomes." Include: "BTC sold, Debt repaid, BTC
 * retained, Debt retained, Resulting equity, Resulting Health Factor,
 * Resulting liquidation price, Costs." DoD: "The user can understand
 * the portfolio state after the proposed exit."
 *
 * **Renders only for a genuine partial-exit RESULT (`after.debtValue >
 * 0`)** — the mutually-exclusive counterpart to `FullExitResult.tsx`;
 * see that component's own header comment for the full "result-driven,
 * not selected-type-driven" reasoning this shares. No independent empty
 * state here — `app/exit-planner/page.tsx` owns the shared "not
 * configured yet"/"infeasible" messaging once.
 *
 * **All 8 named Display items map directly to already-computed
 * `ExitPlanResult` fields — zero new calculation.** `transaction.btcSold`/
 * `.repayment`/`.btcRetained`; `after.debtValue`/`.netEquity`/
 * `.healthFactor`/`.liquidation?.price`. "Costs" reuses the same
 * itemized `costs` convention (conflict #8, resolved for real V4
 * Readiness Audit §12 P1-6) `FullExitResult.tsx` already establishes.
 *
 * **"Resulting liquidation price" is `null` only when `after.liquidation`
 * itself is `null`** — `calculatePortfolioSummary`'s own conflict #20
 * convention (a zero-debt portfolio has no liquidation price) — which
 * cannot actually occur here, since this component only renders when
 * `after.debtValue > 0`; kept as a defensive `?? '—'` rather than a
 * non-null assertion, the same discipline this engagement applies
 * throughout rather than asserting away a type the Service itself
 * declares nullable.
 *
 * **A ninth, V4-only row (V4 Readiness Audit §12 Stage 25D)** — the
 * aggregate "Debt Retained" figure alone gives no visible proof that the
 * real, premium-first Aave V4 repayment rule was used rather than a
 * naive `totalDebt - repayment` figure (both produce the identical
 * aggregate). `transaction.v4DebtBreakdown` (present only for a V4
 * portfolio with real synced `v4DebtState`) itemizes the real
 * `drawnDebt`/`premiumDebt` split `deriveV4DebtStateAfterDelta` actually
 * computed — zero new calculation, purely display of state already
 * carried onto the Service's own "after" portfolio.
 */
const EXIT_COST_LABELS: Record<string, string> = {
  swapFees: 'Swap Fees',
  slippage: 'Slippage',
  gasEstimate: 'Gas Estimate',
  totalImplementationCost: 'Total Implementation Cost',
};

export function PartialExitResult() {
  const currentResult = useExitPlannerStore((state) => state.currentResult);

  if (
    currentResult === null ||
    !currentResult.feasible ||
    currentResult.after === null ||
    currentResult.transaction === null
  ) {
    return null;
  }
  if (currentResult.after.debtValue === 0) {
    return null;
  }

  const { transaction, after, costs } = currentResult;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h3 className="text-sm font-medium text-foreground">Partial Exit Result</h3>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">BTC Sold</span>
        <span className="font-medium text-foreground">{transaction.btcSold.toFixed(8)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Debt Repaid</span>
        <span className="font-medium text-foreground">{formatCurrency(transaction.repayment)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">BTC Retained</span>
        <span className="font-medium text-foreground">{transaction.btcRetained.toFixed(8)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Debt Retained</span>
        <span className="font-medium text-foreground">{formatCurrency(after.debtValue)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Resulting Equity</span>
        <span className="font-medium text-foreground">{formatCurrency(after.netEquity)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Resulting Health Factor</span>
        <span className="font-medium text-foreground">
          {formatHealthFactor(after.healthFactor)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Resulting Liquidation Price</span>
        <span className="font-medium text-foreground">
          {after.liquidation !== null ? formatCurrency(after.liquidation.price) : '—'}
        </span>
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
        <span className="text-muted-foreground">Costs</span>
        <dl className="flex flex-col gap-1 text-xs">
          {costs?.map((entry) => (
            <div key={entry.item} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">
                {/* `?? entry.item` is type-system-provably unreachable —
                    see FullExitResult.tsx's own identical note. */}
                {EXIT_COST_LABELS[entry.item] ?? entry.item}
              </dt>
              <dd className="text-right text-foreground">
                {entry.amountUsd !== null ? (
                  formatCurrency(entry.amountUsd)
                ) : (
                  <span className="text-muted-foreground">{entry.reason}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
