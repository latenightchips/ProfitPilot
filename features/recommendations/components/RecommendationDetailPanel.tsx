'use client';

import { useRouter } from 'next/navigation';

import { formatCurrency, formatHealthFactor } from '@/components/strategy/format';
import {
  ADDITIONAL_COLLATERAL_VALUE_LABELS,
  BTC_VALUE_KEYS,
  HEALTH_FACTOR_VALUE_KEYS,
  REPAYMENT_VALUE_LABELS,
  severityFor,
} from '@/features/recommendations/utils/recommendationTaxonomy';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';
import { useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Recommendation Detail Panel — 06_TASKS.md M7-033 ("Implement
 * Recommendation Detail Panel"). Include: "Triggering condition,
 * Current values, Risk level, Suggested action, Expected effect,
 * Assumptions, Formula IDs, Related strategy tool." DoD: "Every
 * recommendation is understandable and traceable."
 *
 * Also implements M7-034 ("Implement Recommendation Action Links") —
 * "Related strategy tool" is not just a label here, it is a real
 * prefill-and-navigate action: "Reduce debt → Open Exit Planner with
 * target inputs" and "Add collateral → Open Simulation Workspace with
 * an action scenario" are M7-034's own first two named examples, and
 * map directly onto the two recommendations this Recommendation Center
 * ever computes (see `stores/recommendationCenterStore.ts`'s own header
 * comment for why borrow/leverage recommendations — M7-034's other two
 * examples, "Review leverage" and "Update stale data" — have no
 * corresponding action link here: no leverage recommendation is ever
 * computed, per Conflict #29, and no portfolio-level staleness signal
 * exists anywhere in this codebase to drive a "stale data" action
 * honestly).
 *
 * **Actions prefill planning tools but never modify the live portfolio
 * (M7-034's own Requirement).** `setExitType`/`setTargetInputs`/
 * `runExitCalculation` (`stores/exitPlannerStore.ts`) and
 * `runPortfolioActionSimulation` (`stores/simulationStore.ts`) all write
 * only to their own tool's Store — none of them ever calls
 * `usePortfolioStore`'s `update`, and `runPortfolioActionSimulation`
 * takes `portfolio` purely as an input value, computing an
 * `afterPortfolio` object of its own without persisting it anywhere
 * (`services/simulation/portfolioAction.ts`).
 *
 * **The repayment action also calls `runExitCalculation` itself, not
 * just `setTargetInputs` — a real gap found and fixed during this
 * batch's own mandatory manual browser verification.** Without it,
 * Exit Planner's `currentResult` stays whatever it was before
 * navigating (often `null`), so the route would show "Configure an exit
 * target" even though every input needed was already supplied —
 * directly undermining M7-034's own DoD ("without re-entering known
 * data"). Pairs `setTargetInputs` with `runExitCalculation` the same way
 * `ExitTargetForm.tsx`'s own `pushTargetInputs` and Full Exit mount
 * effect already do — see that file's own header comment for the
 * matching fix on its side (the input field itself needed to start
 * showing the prefilled value, which is a separate, form-display-only
 * concern this component has no part in).
 *
 * **The action link is hidden, not disabled, when there is nothing real
 * to prefill** — `relevantValues.requiredRepayment`/`requiredUsd` of
 * `0` means "no repayment/collateral needed" (the Engine's own already-
 * computed answer), so there is nothing honest to hand to Exit Planner
 * or Simulation.
 */
const RELATED_TOOL_BY_ITEM = {
  repayment: 'Exit Planner',
  additionalCollateral: 'Simulation Workspace',
} as const;

function formatRelevantValue(key: string, value: number): string {
  if (BTC_VALUE_KEYS.has(key)) return `${value.toFixed(8)} BTC`;
  if (HEALTH_FACTOR_VALUE_KEYS.has(key)) return formatHealthFactor(value);
  return formatCurrency(value);
}

export function RecommendationDetailPanel({ portfolio }: { portfolio: Portfolio }) {
  const router = useRouter();
  const selectedItemId = useRecommendationCenterStore((state) => state.selectedItemId);
  const actions = useRecommendationCenterStore((state) => state.actions);
  const targetHealthFactor = useRecommendationCenterStore((state) => state.targetHealthFactor);
  const lastMetadata = useRecommendationCenterStore((state) => state.lastMetadata);
  const setExitType = useExitPlannerStore((state) => state.setExitType);
  const setTargetInputs = useExitPlannerStore((state) => state.setTargetInputs);
  const runExitCalculation = useExitPlannerStore((state) => state.runExitCalculation);
  const runPortfolioActionSimulation = useSimulationStore(
    (state) => state.runPortfolioActionSimulation,
  );

  if (selectedItemId === null || actions === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a recommendation from the list to see its full explanation.
      </p>
    );
  }

  const recommendation = actions[selectedItemId];
  const severity = severityFor(recommendation);
  const labels =
    selectedItemId === 'repayment' ? REPAYMENT_VALUE_LABELS : ADDITIONAL_COLLATERAL_VALUE_LABELS;

  const isActionable =
    selectedItemId === 'repayment'
      ? recommendation.relevantValues.requiredRepayment > 0
      : recommendation.relevantValues.requiredUsd > 0;

  function runAction() {
    if (selectedItemId === 'repayment') {
      setExitType('partialDebtRepayment');
      setTargetInputs({ repaymentAmount: recommendation.relevantValues.requiredRepayment });
      runExitCalculation(portfolio, portfolio.settings.executionCostAssumptions);
      router.push('/exit-planner');
      return;
    }
    runPortfolioActionSimulation(portfolio, {
      collateralDelta: recommendation.relevantValues.equivalentBtc,
      debtDelta: 0,
    });
    router.push('/simulation');
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Triggering Condition</span>
        <span className="text-muted-foreground">{recommendation.triggeringCondition}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Current Values</span>
        <dl className="flex flex-col gap-1">
          {Object.entries(recommendation.relevantValues).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <dt className="text-muted-foreground">
                {/* `?? key` is type-system-provably unreachable — REPAYMENT_VALUE_LABELS
                    and ADDITIONAL_COLLATERAL_VALUE_LABELS each cover exactly the five
                    relevantValues keys the corresponding Engine function always
                    produces (recommendationTaxonomy.test.ts asserts this exhaustively),
                    the same UNAVAILABLE_COST_LABELS-style precedent FullExitResult.tsx
                    already establishes. */}
                {labels[key] ?? key}
              </dt>
              <dd className="text-right text-foreground">{formatRelevantValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Risk Level</span>
        <span className="text-muted-foreground">
          {severity} — {recommendation.decisionPriority}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Suggested Action</span>
        <span className="text-muted-foreground">{recommendation.suggestedAction}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Expected Effect</span>
        <span className="text-muted-foreground">{recommendation.expectedEffect}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Assumptions</span>
        <span className="text-muted-foreground">
          Uses this portfolio&rsquo;s own configured Target Health Factor (
          {/* `: '—'` is unreachable here — `recalculate` always sets `actions` and
              `targetHealthFactor` together in the same `set()` call
              (stores/recommendationCenterStore.ts), and this branch only renders once
              `actions !== null` was already confirmed above. Kept as a defensive
              type-narrowing guard, the same class as this file's own `isActionable`
              reasoning. */}
          {targetHealthFactor !== null ? formatHealthFactor(targetHealthFactor) : '—'}) from
          Portfolio Settings → Safety Targets. No transaction costs, fees, slippage, or gas are
          included — no Formula ID or equation for any of them exists in 02_Formulas.md
          (PROJECT_STATUS.md Conflict #8, the same gap Loop Builder and Exit Planner both document).
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Formula IDs</span>
        <span className="text-muted-foreground">{recommendation.formulaReferences.join(', ')}</span>
      </div>

      {lastMetadata !== null && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">Formula Version</span>
          <span className="text-muted-foreground">
            Engine {lastMetadata.engineVersion} · Formula {lastMetadata.formulaVersion}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="text-xs font-medium text-foreground">Related Strategy Tool</span>
        {isActionable ? (
          <button
            type="button"
            onClick={runAction}
            className="self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
          >
            Open {RELATED_TOOL_BY_ITEM[selectedItemId]} with this target
          </button>
        ) : (
          <span className="text-muted-foreground">
            No action needed — {RELATED_TOOL_BY_ITEM[selectedItemId]} has nothing to prefill for
            this recommendation.
          </span>
        )}
      </div>
    </div>
  );
}
