'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import {
  formatCurrency,
  formatHealthFactor,
  formatLeverage,
  formatPercent,
} from '@/components/strategy/format';
import { ApplyToPortfolioReview } from '@/features/portfolioApply';
import {
  ADDITIONAL_COLLATERAL_VALUE_LABELS,
  BTC_VALUE_KEYS,
  HEALTH_FACTOR_VALUE_KEYS,
  isActionableRecommendation,
  REPAYMENT_VALUE_LABELS,
  severityFor,
} from '@/features/recommendations/utils/recommendationTaxonomy';
import type { RecommendationExplanation, RecommendationExplanationSet } from '@/services';
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
 * **The action link is hidden, not disabled, when there is nothing real
 * to prefill** — `relevantValues.requiredRepayment`/`requiredUsd` of
 * `0` means "no repayment/collateral needed" (the Engine's own already-
 * computed answer), so there is nothing honest to hand to Exit Planner
 * or Simulation.
 *
 * **V1.1 Batch 5 ("Recommendation Quality & Explainability")** adds a
 * `RecommendationExplanation` (`services/recommendation`) alongside the
 * raw `Recommendation` for the currently selected item — Quantified
 * Impact (real before/after `PortfolioSummary` values, reusing Batch 3's
 * own `buildPortfolioActionApplyProposal`), Risk/Tradeoff, Cost Impact,
 * and Data Confidence. **"Review/apply a valid proposal" (Section 7)
 * reuses `ApplyToPortfolioReview` unmodified** — `explanation.applyProposal`
 * IS a real `PortfolioApplyProposal`, the exact same type Simulation/Loop
 * Builder/Exit Planner already apply through, so this is a second trigger
 * for the SAME confirmation UX and the SAME `applyPortfolioState` Store
 * action (V1.1 Batch 3), never a parallel apply path. This coexists with
 * the pre-existing prefill-into-planner action below — Apply is a direct
 * commit, prefill-into-planner is a lower-commitment way to explore
 * further changes (e.g. a different repayment amount) before committing
 * anything.
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

function ImpactRow({
  label,
  before,
  after,
  changed,
}: {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">
        {changed ? (
          <>
            {before} <span aria-hidden="true">→</span>
            <span className="sr-only"> to </span> {after}
          </>
        ) : (
          after
        )}
      </dd>
    </div>
  );
}

function ExplanationExtras({
  explanation,
  applyReviewOpen,
  onOpenApplyReview,
  onApplied,
  onCancelApplyReview,
  portfolio,
}: {
  explanation: RecommendationExplanation;
  applyReviewOpen: boolean;
  onOpenApplyReview: () => void;
  onApplied: () => void;
  onCancelApplyReview: () => void;
  portfolio: Portfolio;
}) {
  const { impact } = explanation;

  return (
    <>
      {impact !== null && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">Quantified Impact</span>
          <dl className="flex flex-col gap-1">
            <ImpactRow
              label="Health Factor"
              before={formatHealthFactor(impact.healthFactor.before)}
              after={formatHealthFactor(impact.healthFactor.after)}
              changed={impact.healthFactor.before !== impact.healthFactor.after}
            />
            <ImpactRow
              label="Leverage"
              before={formatLeverage(impact.leverage.before)}
              after={formatLeverage(impact.leverage.after)}
              changed={impact.leverage.before !== impact.leverage.after}
            />
            <ImpactRow
              label="Loan-to-Value"
              before={formatPercent(impact.loanToValue.before)}
              after={formatPercent(impact.loanToValue.after)}
              changed={impact.loanToValue.before !== impact.loanToValue.after}
            />
            <ImpactRow
              label="Collateral Value"
              before={formatCurrency(impact.collateralValue.before)}
              after={formatCurrency(impact.collateralValue.after)}
              changed={impact.collateralValue.before !== impact.collateralValue.after}
            />
            <ImpactRow
              label="Debt Value"
              before={formatCurrency(impact.debtValue.before)}
              after={formatCurrency(impact.debtValue.after)}
              changed={impact.debtValue.before !== impact.debtValue.after}
            />
            <ImpactRow
              label="Annual Borrowing Cost"
              before={formatCurrency(impact.interestCost.before)}
              after={formatCurrency(impact.interestCost.after)}
              changed={impact.interestCost.before !== impact.interestCost.after}
            />
            <ImpactRow
              label="Liquidation Price"
              before={
                impact.liquidationPrice.before !== null
                  ? formatCurrency(impact.liquidationPrice.before)
                  : 'No liquidation risk'
              }
              after={
                impact.liquidationPrice.after !== null
                  ? formatCurrency(impact.liquidationPrice.after)
                  : 'No liquidation risk'
              }
              changed={impact.liquidationPrice.before !== impact.liquidationPrice.after}
            />
          </dl>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Risk / Tradeoff</span>
        <span className="text-muted-foreground">{explanation.risk}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Cost Impact</span>
        <span className="text-muted-foreground">{explanation.costBenefit}</span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Data Confidence</span>
        <span className="text-muted-foreground">{explanation.confidence}</span>
      </div>

      {explanation.applyProposal !== null && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="text-xs font-medium text-foreground">Apply to Portfolio</span>
          {applyReviewOpen ? (
            <ApplyToPortfolioReview
              portfolio={portfolio}
              proposal={explanation.applyProposal}
              onApplied={onApplied}
              onCancel={onCancelApplyReview}
            />
          ) : (
            <button
              type="button"
              onClick={onOpenApplyReview}
              className="self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              Review Apply to Portfolio
            </button>
          )}
        </div>
      )}
    </>
  );
}

export function RecommendationDetailPanel({
  portfolio,
  explanations,
}: {
  portfolio: Portfolio;
  explanations: RecommendationExplanationSet | null;
}) {
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
  const [applyReviewOpen, setApplyReviewOpen] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setApplyReviewOpen(false);
    setApplied(false);
  }, [selectedItemId]);

  if (selectedItemId === null || actions === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Select a recommendation from the list to see its full explanation.
      </p>
    );
  }

  const recommendation = actions[selectedItemId];
  const explanation = explanations?.[selectedItemId] ?? null;
  const severity = severityFor(selectedItemId, recommendation);
  const labels =
    selectedItemId === 'repayment' ? REPAYMENT_VALUE_LABELS : ADDITIONAL_COLLATERAL_VALUE_LABELS;

  const isActionable = isActionableRecommendation(selectedItemId, recommendation);

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

      {explanation !== null && applied ? (
        <p role="status" className="text-xs text-muted-foreground">
          Applied to portfolio.
        </p>
      ) : (
        explanation !== null && (
          <ExplanationExtras
            explanation={explanation}
            applyReviewOpen={applyReviewOpen}
            onOpenApplyReview={() => setApplyReviewOpen(true)}
            onApplied={() => {
              setApplyReviewOpen(false);
              setApplied(true);
            }}
            onCancelApplyReview={() => setApplyReviewOpen(false)}
            portfolio={portfolio}
          />
        )
      )}

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
