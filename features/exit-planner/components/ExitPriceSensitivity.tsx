'use client';

import { formatCurrency } from '@/components/strategy/format';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Exit Price Sensitivity — 06_TASKS.md M7-028 ("Implement Exit Price
 * Sensitivity"). Dependencies: M7-023. Priority P1, Effort M.
 * Description: "Show how exit outcomes change at different BTC
 * prices." Compare: "Current price, User target price, Lower-price
 * case, Higher-price case." Display: "Net proceeds, Debt repaid, BTC
 * retained, Resulting equity." DoD: "Users can understand how price
 * uncertainty affects an exit plan."
 *
 * **Reuses `planExit` directly per price point — see
 * `stores/exitPlannerStore.ts`'s own `runPriceSensitivity` header
 * comment for the full reasoning (why this differs from Loop's own
 * sensitivity composition, the ±20% assumption, why an infeasible
 * current-price target does not block this feature).**
 *
 * **"Net proceeds" is `transaction.repayment` — same reconciliation
 * `FullExitResult.tsx` already documents (Gross Sale Value = Debt
 * Repaid, since this Engine sells exactly enough BTC to cover the
 * target, never more).** Shown as "—" for a price point where that
 * point's own `result.feasible` is `false` (a genuinely reachable case
 * for `healthFactor`/`retainedBtc` targets, whose resolved target debt
 * is price-dependent), never a fabricated number.
 */
export function ExitPriceSensitivity({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const exitType = useExitPlannerStore((state) => state.exitType);
  const currentResult = useExitPlannerStore((state) => state.currentResult);
  const priceSensitivity = useExitPlannerStore((state) => state.priceSensitivity);
  const priceSensitivityErrors = useExitPlannerStore((state) => state.priceSensitivityErrors);
  const runPriceSensitivity = useExitPlannerStore((state) => state.runPriceSensitivity);

  if (exitType === null || currentResult === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure an exit target to stress-test it against price uncertainty.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <button
        type="button"
        onClick={() => runPriceSensitivity(portfolio)}
        className="self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
      >
        Run Price Sensitivity
      </button>

      {priceSensitivityErrors.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {priceSensitivityErrors.map((error) => error.message).join(' ')}
        </p>
      )}

      {priceSensitivity !== null && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-1">
                Scenario
              </th>
              <th scope="col" className="py-1">
                BTC Price
              </th>
              <th scope="col" className="py-1">
                Net Proceeds
              </th>
              <th scope="col" className="py-1">
                BTC Retained
              </th>
              <th scope="col" className="py-1">
                Resulting Equity
              </th>
            </tr>
          </thead>
          <tbody>
            {priceSensitivity.map((point) => (
              <tr key={point.label}>
                <td className="py-1 text-muted-foreground">{point.label}</td>
                <td className="py-1 text-foreground">{formatCurrency(point.priceUsd)}</td>
                {point.result.feasible &&
                point.result.transaction !== null &&
                point.result.after !== null ? (
                  <>
                    <td className="py-1 text-foreground">
                      {formatCurrency(point.result.transaction.repayment)}
                    </td>
                    <td className="py-1 text-foreground">
                      {point.result.transaction.btcRetained.toFixed(8)}
                    </td>
                    <td className="py-1 text-foreground">
                      {formatCurrency(point.result.after.netEquity)}
                    </td>
                  </>
                ) : (
                  <td colSpan={3} className="py-1 text-destructive">
                    Infeasible — {point.result.infeasibleReason ?? 'target not achievable.'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
