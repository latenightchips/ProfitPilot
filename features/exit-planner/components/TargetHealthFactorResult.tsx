'use client';

import { formatHealthFactor } from '@/components/strategy/format';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Target Health Factor Result — 06_TASKS.md M7-026 ("Implement Target
 * Health Factor Exit"). Dependencies: M7-023. Priority P1, Effort M.
 * Description: "Calculate the minimum exit action required to reach a
 * target Health Factor." Display: "Collateral sale required, Debt
 * repayment, BTC retained, Resulting Health Factor, Difference from
 * target." DoD: "The resulting state is independently verified against
 * the target."
 *
 * **Renders only when `exitType === 'targetHealthFactor'`** — unlike
 * `FullExitResult.tsx`/`PartialExitResult.tsx` (which are driven by the
 * *result*, not the selected type), this component's own "Difference
 * from Target" row needs the user's own requested
 * `targetInputs.targetHealthFactor`, which only exists for this one
 * type. It renders *alongside* whichever of Full/Partial Exit Result
 * also applies to the same result — the three are not mutually
 * exclusive with each other in this one case, since a Target Health
 * Factor request can resolve to either a full or partial exit outcome.
 *
 * **"Collateral sale required," "Debt repayment," and "BTC retained"
 * map directly to `transaction.btcSold`/`.repayment`/`.btcRetained`** —
 * already shown by whichever of Full/Partial Exit Result also renders;
 * repeated here because this component's own DoD ("independently
 * verified against the target") is about the *complete* picture next to
 * the target, not a fragment referencing the other section.
 *
 * **"Difference from target" is `after.healthFactor -
 * targetInputs.targetHealthFactor` — a real, computed difference, not
 * hidden.** PROJECT_STATUS.md Conflict #13 (already documented in
 * `services/exit/plan.ts`'s own header comment: "F-040's fixed-collateral
 * approximation... the resulting Health Factor undershoots this target
 * whenever a nontrivial sale occurs") means this difference is
 * routinely non-zero — showing it plainly, with the conflict cited, *is*
 * the "independently verified against the target" DoD in practice: the
 * Engine's own approximation is disclosed, not silently accepted as
 * exact.
 */
export function TargetHealthFactorResult() {
  const exitType = useExitPlannerStore((state) => state.exitType);
  const targetInputs = useExitPlannerStore((state) => state.targetInputs);
  const currentResult = useExitPlannerStore((state) => state.currentResult);

  if (exitType !== 'targetHealthFactor') {
    return null;
  }
  if (
    currentResult === null ||
    !currentResult.feasible ||
    currentResult.after === null ||
    currentResult.transaction === null ||
    targetInputs?.targetHealthFactor === undefined
  ) {
    return null;
  }

  const { transaction, after } = currentResult;
  const difference = after.healthFactor - targetInputs.targetHealthFactor;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h3 className="text-sm font-medium text-foreground">Target Health Factor Detail</h3>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Collateral Sale Required</span>
        <span className="font-medium text-foreground">{transaction.btcSold.toFixed(8)} BTC</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Debt Repayment</span>
        <span className="font-medium text-foreground">{transaction.repayment.toFixed(2)} USD</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">BTC Retained</span>
        <span className="font-medium text-foreground">{transaction.btcRetained.toFixed(8)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Resulting Health Factor</span>
        <span className="font-medium text-foreground">
          {formatHealthFactor(after.healthFactor)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Difference From Target</span>
        <span className={`font-medium ${difference < 0 ? 'text-destructive' : 'text-foreground'}`}>
          {difference >= 0 ? '+' : ''}
          {formatHealthFactor(difference)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        A non-zero difference is expected — the underlying formula (F-040) assumes fixed collateral,
        but this exit actually sells BTC, which changes collateral value too (PROJECT_STATUS.md
        Conflict #13).
      </p>
    </div>
  );
}
