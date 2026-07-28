'use client';

import type { ScenarioMetric } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

import { formatCurrency, formatHealthFactor, formatLeverage } from '../utils/format';

/**
 * Scenario Summary — 06_TASKS.md M6-009 ("Implement Scenario Summary").
 * Dependencies: M6-005, M6-008. Description: Display "Portfolio value,
 * Debt, Health Factor, Liquidation price, Leverage, Interest cost,
 * Profit/Loss, Warnings" (8 items). DoD: "Summary displays only
 * calculated Service results."
 *
 * **Replaces the M6-001 "Simulation Results" placeholder** — the first
 * real content in that region. Renders each of the Store's two,
 * independent result fields (`currentResult` — price/interest scenarios,
 * M6-005/M6-006/M6-007 — and `portfolioActionPreview` — portfolio
 * actions, M6-008) in its own labeled section, whenever populated.
 *
 * **Both sections render simultaneously when both fields are
 * populated — an "if currentResult, else portfolioActionPreview"
 * branch was tried first and found wrong during this batch's own
 * mandatory manual browser verification.** `setCurrentScenario` and
 * `runPortfolioActionSimulation` are genuinely independent Store
 * actions (Batch 5's own design) — neither clears the other's field —
 * so a real user touching both a price field and a Collateral/Debt
 * field in the same session (an entirely ordinary interaction) leaves
 * *both* fields populated at once. Picking only one to display would
 * have silently hidden a real, already-calculated Service result,
 * directly contradicting this task's own DoD ("Summary displays only
 * calculated Service results" — not "displays only some of them").
 * Each section carries its own heading so the two never read as
 * conflicting numbers for the same thing.
 *
 * **Every number rendered comes directly from a `SimulationResult`/
 * `PortfolioActionSimulationResult` field — zero UI-side arithmetic.**
 * For price/interest scenarios, `currentResult.comparison.differences`
 * (`compareScenarios`, F-053, already computed by `simulateScenario`)
 * is iterated directly rather than subtracting `baseline`/`scenario`
 * values here. For portfolio actions, `before`/`after` `PortfolioSummary`
 * fields are read directly, and `profitOrLoss` is Batch 9's own Service
 * addition (`services/simulation/portfolioAction.ts`) — never
 * recomputed in this component.
 *
 * **"Debt" is a documented gap for price/interest scenarios, not
 * fabricated.** `ScenarioSummary` (`engine/simulation/compareScenarios.ts`)
 * has no raw debt-balance field — only `debtCost` (interest cost, a
 * different concept). Deriving Debt from Health Factor/Liquidation
 * Distance algebraically would duplicate Formula Engine logic in the UI
 * (forbidden), and extending `ScenarioSummary` itself would modify a
 * completed Milestone 2 Engine type. Only portfolio-action results (which
 * use `PortfolioSummary`, a richer Service-level type with a real
 * `debtValue` field) show Debt. "Liquidation Price" has the same
 * asymmetry: only `liquidationDistance` exists for price/interest
 * scenarios, so that row is honestly labeled "Liquidation Distance"
 * there, not mislabeled "Price."
 *
 * **"Warnings" surfaces real, already-computed `ServiceWarning[]`
 * (Batch 9's own Store change) — not M6-014's own richer warning
 * categories.** `06_TASKS.md` M6-014 ("Implement Simulation Warnings")
 * is a separate, later, dedicated task (Dependencies: M6-009) that adds
 * its own specific categories (Unsafe Health Factor, Near liquidation,
 * Stale prices, Invalid assumptions) — a genuinely richer concern this
 * batch does not pre-empt. What is shown here is only whatever the
 * Simulation/Portfolio Action Service calls already returned.
 */
const METRIC_LABELS: Record<ScenarioMetric, string> = {
  equity: 'Portfolio Value',
  profitOrLoss: 'Profit/Loss',
  healthFactor: 'Health Factor',
  liquidationDistance: 'Liquidation Distance',
  debtCost: 'Interest Cost',
  leverage: 'Leverage',
};

const METRIC_ORDER: ScenarioMetric[] = [
  'equity',
  'healthFactor',
  'liquidationDistance',
  'leverage',
  'debtCost',
  'profitOrLoss',
];

function formatMetric(metric: ScenarioMetric, value: number): string {
  switch (metric) {
    case 'healthFactor':
    case 'liquidationDistance':
      return formatHealthFactor(value);
    case 'leverage':
      return formatLeverage(value);
    default:
      return formatCurrency(value);
  }
}

function SummaryRow({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">
        {before} <span aria-hidden="true">→</span> {after}
      </span>
    </div>
  );
}

function PriceOrInterestSummary() {
  const currentResult = useSimulationStore((state) => state.currentResult);
  if (currentResult === null) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">Price / Interest Scenario</span>
      {METRIC_ORDER.map((metric) => {
        const difference = currentResult.comparison.differences.find((d) => d.metric === metric);
        if (!difference) return null;
        return (
          <SummaryRow
            key={metric}
            label={METRIC_LABELS[metric]}
            before={formatMetric(metric, difference.scenarioAValue)}
            after={formatMetric(metric, difference.scenarioBValue)}
          />
        );
      })}
      <p className="text-xs text-muted-foreground">
        Debt is not shown for price/interest scenarios — see this component&rsquo;s own source
        comment.
      </p>
    </div>
  );
}

function PortfolioActionSummary() {
  const preview = useSimulationStore((state) => state.portfolioActionPreview);
  if (preview === null) return null;

  const liquidationBefore = preview.before.liquidation?.price ?? null;
  const liquidationAfter = preview.after.liquidation?.price ?? null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-foreground">Portfolio Action</span>
      <SummaryRow
        label="Portfolio Value"
        before={formatCurrency(preview.before.netEquity)}
        after={formatCurrency(preview.after.netEquity)}
      />
      <SummaryRow
        label="Debt"
        before={formatCurrency(preview.before.debtValue)}
        after={formatCurrency(preview.after.debtValue)}
      />
      <SummaryRow
        label="Health Factor"
        before={formatHealthFactor(preview.before.healthFactor)}
        after={formatHealthFactor(preview.after.healthFactor)}
      />
      <SummaryRow
        label="Liquidation Price"
        before={liquidationBefore === null ? '—' : formatCurrency(liquidationBefore)}
        after={liquidationAfter === null ? '—' : formatCurrency(liquidationAfter)}
      />
      <SummaryRow
        label="Leverage"
        before={formatLeverage(preview.before.leverage)}
        after={formatLeverage(preview.after.leverage)}
      />
      <SummaryRow
        label="Interest Cost"
        before={formatCurrency(preview.before.interestCost)}
        after={formatCurrency(preview.after.interestCost)}
      />
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Profit/Loss</span>
        <span className="font-medium text-foreground">{formatCurrency(preview.profitOrLoss)}</span>
      </div>
    </div>
  );
}

export function ScenarioSummary() {
  const currentResult = useSimulationStore((state) => state.currentResult);
  const portfolioActionPreview = useSimulationStore((state) => state.portfolioActionPreview);
  const warnings = useSimulationStore((state) => state.warnings);

  if (currentResult === null && portfolioActionPreview === null) {
    return (
      <p className="text-sm text-muted-foreground">Change a scenario input to see results here.</p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {currentResult !== null && <PriceOrInterestSummary />}
      {portfolioActionPreview !== null && <PortfolioActionSummary />}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <span className="text-xs font-medium text-foreground">Warnings</span>
          {warnings.map((warning) => (
            <p key={warning.code} className="text-xs text-destructive">
              {warning.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
