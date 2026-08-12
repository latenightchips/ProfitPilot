'use client';

import { useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

import { buildSimulationWarnings } from '../utils/buildSimulationWarnings';

/**
 * Simulation Warnings — 06_TASKS.md M6-014 ("Implement Simulation
 * Warnings"). Dependencies: M6-009. DoD: "Warnings explain both the
 * cause and potential impact." Names no `Requirements` section, the
 * same as M6-012/M6-013.
 *
 * **Takes `portfolio: Portfolio`, not `ApplicationPortfolio`** — unlike
 * every other Simulation component, this one needs
 * `settings.safetyTargets?.targetHealthFactor` and `marketUpdatedAt`,
 * both fields `Portfolio` (`@/types/portfolio`, M4-001) adds on top of
 * `ApplicationPortfolio`. `app/simulation/page.tsx` already holds the
 * full `Portfolio` record (`record.portfolio`); every other Simulation
 * component simply never needed the extra fields.
 *
 * **Renders whenever either simulation result exists** — the same gate
 * `SimulationAssumptions.tsx` (Batch 12) uses — computing whichever
 * simulated Health Factor is active (`currentResult.scenario` or
 * `portfolioActionPreview.after`) and handing it to
 * `buildSimulationWarnings`, which does the real work. See that file's
 * own header comment, and `../types/simulationWarnings.ts`, for the
 * full "2 built, 4 blocked" reasoning.
 *
 * **A zero-warnings result is shown as positive confirmation text, not
 * rendered as nothing** — the same "always-visible section" convention
 * every other Simulation component already follows (`ScenarioSummary`,
 * `ScenarioComparison`, `ScenarioCharts`, `ScenarioTimeline`,
 * `SimulationAssumptions`), unlike `RiskWarningBanner.tsx`
 * (`features/dashboard/`, M5-010), which renders `null` on zero
 * warnings since it is a floating banner, not a fixed page section.
 */
export function SimulationWarnings({ portfolio }: { portfolio: Portfolio }) {
  const currentResult = useSimulationStore((state) => state.currentResult);
  const portfolioActionPreview = useSimulationStore((state) => state.portfolioActionPreview);

  if (currentResult === null && portfolioActionPreview === null) {
    return <p className="text-sm text-muted-foreground">Run a simulation to see any warnings.</p>;
  }

  const simulatedHealthFactor =
    currentResult?.scenario.healthFactor ?? portfolioActionPreview?.after.healthFactor ?? null;
  const warnings = buildSimulationWarnings(portfolio, simulatedHealthFactor);

  return (
    <div className="flex flex-col gap-3 text-sm">
      {warnings.length === 0 ? (
        <p className="text-muted-foreground">No warnings for this simulation.</p>
      ) : (
        warnings.map((warning) => (
          <div
            key={warning.code}
            role="alert"
            className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3"
          >
            <p className="text-foreground">{warning.reason}</p>
            <p className="text-muted-foreground">{warning.potentialImpact}</p>
          </div>
        ))
      )}
      <p className="text-xs text-muted-foreground">
        Near liquidation, Invalid assumptions, High leverage, and High borrowing cost aren&rsquo;t
        checked — there&rsquo;s no defined threshold for any of them yet.
      </p>
    </div>
  );
}
