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
 *
 * **Warning list keying fixed (Batch 16, M6-017's own mandatory manual
 * browser verification) — a real, pre-existing bug, unrelated to
 * M6-017's own scope, found and fixed the same way Batch 8's "both
 * sections render simultaneously" finding above was.** `warnings.map`
 * previously keyed each row by `warning.code` alone; a `ServiceWarning[]`
 * can genuinely contain two entries with the same `code` (for example,
 * a deeply negative-equity intermediate price briefly producing more
 * than one `NEGATIVE_EQUITY`-coded entry), which produced a real React
 * "duplicate key" console error and put list-identity at risk. Keyed by
 * `` `${warning.code}-${index}` `` instead — no change to what is
 * displayed, only to React's own row identity.
 *
 * **A calculation-failure error display now exists (Batch 25, M6-026,
 * "UI Specification Audit" — Review item "States") — a real,
 * previously-unbuilt gap found by this batch's own audit, not merely a
 * cosmetic addition.** Before this batch, `stores/simulationStore.ts`'s
 * own `status`/`errors` fields (set correctly on every `runSimulation`/
 * `runPortfolioActionSimulation` failure, and already tested at the
 * Store level since Batch 1) were never read by any component
 * anywhere in the Simulation Workspace — confirmed by a direct search
 * across every `features/simulation/components/*.tsx` file. This is
 * genuinely reachable, not defensive-but-unreachable code: a portfolio
 * with zero collateral and nonzero debt (a valid, creatable Milestone
 * 4 portfolio state — the same state `DashboardErrorBanner`, M5-021,
 * already handles for the Dashboard) makes `simulateScenario`'s own
 * internal baseline re-snapshot fail, and `validateScenarioBuilderInput`
 * (M6-004) has no rule that could ever catch this, since the problem is
 * with the *portfolio itself*, not the scenario delta being entered.
 * Reuses `DashboardErrorBanner`'s own `role="alert"`/error-code display
 * shape, but deliberately omits its Retry/recovery-copy buttons —
 * Simulation's own governing "every input updates immediately, no
 * Calculate/Retry button" design philosophy (`03_UI.md` Page 5's own
 * DESIGN PHILOSOPHY, already cited throughout this milestone) means
 * the next input change is the retry; inventing a redundant button
 * would contradict that principle rather than follow it.
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
  const status = useSimulationStore((state) => state.status);
  const errors = useSimulationStore((state) => state.errors);

  if (status === 'error' && errors.length > 0) {
    return (
      <div
        role="alert"
        className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm"
      >
        <p className="font-medium text-destructive">Unable to calculate this simulation.</p>
        {errors.map((error) => (
          <div key={error.code} className="mt-1">
            <p className="text-destructive">{error.message}</p>
            <p className="text-xs text-muted-foreground">Error code: {error.code}</p>
          </div>
        ))}
        <p className="mt-2 text-xs text-muted-foreground">
          Your portfolio is unchanged. Adjust the scenario inputs to try again.
        </p>
      </div>
    );
  }

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
          {warnings.map((warning, index) => (
            <p key={`${warning.code}-${index}`} className="text-xs text-destructive">
              {warning.message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
