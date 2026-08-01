'use client';

import { formatCurrency, formatLeverage, formatPercent } from '@/components/strategy/format';
import { type UnavailableLoopCost } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Cost Analysis — 06_TASKS.md M7-014 ("Implement Loop Cost
 * Analysis"). Dependencies: M7-010, M7-005. Priority P0, Effort M.
 * Description: "Create a dedicated cost section." Display: "Total
 * interest cost, Monthly interest cost, Implementation costs (itemized),
 * Break-even appreciation needed, Effective leverage achieved." DoD:
 * "Users understand the real cost of leverage."
 *
 * **All 5 named Display items map directly to already-real, already-
 * computed data — zero new Formula Engine logic.** "Total interest cost"
 * reads `currentResult.costs.borrowingInterest` (F-032, Annual — the
 * Engine's own field name; "Total" here means the annual total, the same
 * reading `LoopStrategySummary.tsx`'s own "Annual Interest Cost" row
 * already uses for this same field). "Monthly interest cost" reads
 * `currentResult.monthlyInterestCost` (F-031, added this same batch —
 * see `services/loop/strategy.ts`'s own header comment; deliberately NOT
 * `borrowingInterest / 12`, matching the non-simple-division day-count
 * convention `services/portfolio/interestBreakdown.ts` already
 * established). "Break-even appreciation needed" reads
 * `currentResult.costs.breakEvenAppreciation` (F-037). "Effective
 * leverage achieved" reads `currentResult.strategy.finalLeverage` (F-011,
 * already computed by `calculateLoopStrategy`, M2-016) — the same field
 * `StrategyComparison`'s own "Leverage" row already displays for the
 * "Proposed" column, read here a second time for this component's own
 * narrower, cost-focused framing.
 *
 * **"Implementation costs (itemized)" reuses the Engine's own
 * `LoopCostResult.unavailable` array (conflict #8) rather than
 * fabricating a total** — `calculateLoopCosts` (M2-017) already itemizes
 * exactly why `swapFees`/`slippage`/`gasEstimate`/`totalImplementationCost`
 * cannot be computed (no Formula ID in 02_Formulas.md for any of the
 * three underlying costs, so a "total" cannot be honestly derived
 * either). Rendered as 4 explicit "Not itemized — <reason>" rows, the
 * same honest-gap convention `LoopStrategySummary.tsx`'s own "Estimated
 * Implementation Cost" row already established for this exact conflict.
 *
 * **The `unavailable(item)` lookup's own "not found" fallback is
 * type-system-provably unreachable, not force-tested** — `UNAVAILABLE_COSTS`
 * (`engine/loop/calculateLoopCosts.ts`) is a hardcoded 4-entry array and
 * this component iterates the exact same 4 literal item names, so the
 * lookup can never miss in practice. `monthlyInterestCost !== null`'s own
 * false branch is equally unreachable here: this component's own
 * top-level guard already requires `currentResult.strategy !== null`,
 * and `planLoopStrategy` (see that Service's own header comment)
 * guarantees `monthlyInterestCost` is non-null exactly when `strategy`
 * is non-null. Neither is force-tested just to move a coverage
 * percentage, the same discipline this engagement has applied
 * consistently since Milestone 6 Batch 22's own audit.
 */
const ITEMIZED_COSTS: UnavailableLoopCost['item'][] = [
  'swapFees',
  'slippage',
  'gasEstimate',
  'totalImplementationCost',
];

const ITEMIZED_COST_LABELS: Record<UnavailableLoopCost['item'], string> = {
  swapFees: 'Swap Fees',
  slippage: 'Slippage',
  gasEstimate: 'Gas Estimate',
  totalImplementationCost: 'Total Implementation Cost',
};

function unavailable(
  items: UnavailableLoopCost[],
  item: UnavailableLoopCost['item'],
): UnavailableLoopCost | undefined {
  return items.find((entry) => entry.item === item);
}

export function LoopCostAnalysis() {
  const currentResult = useLoopBuilderStore((state) => state.currentResult);

  if (currentResult === null || currentResult.costs === null || currentResult.strategy === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a viable strategy to see its cost analysis.
      </p>
    );
  }

  const { costs, strategy, monthlyInterestCost } = currentResult;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Effective Leverage Achieved</span>
        <span className="font-medium text-foreground">
          {formatLeverage(strategy.finalLeverage)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Total (Annual) Interest Cost</span>
        <span className="font-medium text-foreground">
          {formatCurrency(costs.borrowingInterest)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Monthly Interest Cost</span>
        <span className="font-medium text-foreground">
          {monthlyInterestCost !== null ? formatCurrency(monthlyInterestCost) : '—'}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Break-Even BTC Appreciation Needed</span>
        <span className="font-medium text-foreground">
          {formatPercent(costs.breakEvenAppreciation)}
        </span>
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <span className="text-muted-foreground">Implementation Costs</span>
        <dl className="flex flex-col gap-1 text-xs">
          {ITEMIZED_COSTS.map((item) => {
            const entry = unavailable(costs.unavailable, item);
            return (
              <div key={item} className="flex justify-between gap-2">
                <dt className="text-muted-foreground">{ITEMIZED_COST_LABELS[item]}</dt>
                <dd className="text-right text-muted-foreground">
                  Not itemized — {entry?.reason ?? 'Not itemized.'}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
}
