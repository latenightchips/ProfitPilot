'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import { useSimulationStore } from '@/stores/simulationStore';

import { formatCurrency, formatHealthFactor } from '../utils/format';

/**
 * Scenario Charts — 06_TASKS.md M6-011 ("Implement Scenario Charts").
 * Dependencies: M6-010. Description: "Create charts for: Portfolio
 * value, Health Factor, Debt, Interest cost, BTC exposure" (5 items).
 * Requirements: "Accessible alternatives, Responsive." DoD: "Charts
 * enhance understanding without replacing numerical data."
 *
 * **Visualizes the exact same selection `ScenarioComparison` (M6-010,
 * Batch 9) already manages** — `savedScenarios`/`comparisonSelection`
 * (`stores/simulationStore.ts`, real since Batch 2) — rather than a
 * separate data source. `03_UI.md`'s own general "Design System"
 * chapter ("Charts: Simple, Interactive, Minimal gridlines") is applied
 * here as the visual style; no dedicated "Scenario Charts" mockup
 * exists in either spec document, so `06_TASKS.md`'s own literal
 * `Description` list is the sole source of truth for what to chart.
 *
 * **Only 3 of the 5 named chart targets are actually chartable — a
 * structural, permanent gap for this milestone's data, not a
 * "sometimes" one.** `saveCurrentScenario` (Batch 2) only ever saves
 * `currentResult` (price/interest scenarios); it never saves
 * `portfolioActionPreview`. `SavedSimulation.result.scenario` is a
 * `ScenarioSummary` (`engine/simulation/compareScenarios.ts`), which
 * has no `debtValue`/`collateralValue` field at all — the same gap
 * `ScenarioSummary.tsx` (Batch 8) and `ScenarioComparison.tsx`
 * (Batch 9) already found and documented for "Debt." "BTC exposure"
 * (F-010, `engine/portfolio/calculateExposure.ts`) is numerically
 * identical to Collateral Value under this whole engagement's Conflict
 * A (single collateral position) — also absent from `ScenarioSummary`.
 * Unlike Batch 8/9's gaps, which resolve for portfolio-action results,
 * there is no saved-scenario path that ever carries this data, so
 * "Debt" and "BTC exposure" charts are not built at all, documented
 * here rather than rendered empty or fabricated.
 *
 * **"Accessible alternatives" (Requirement) is satisfied two ways.**
 * First, `ScenarioComparison`'s own table (rendered directly above this
 * component on the page) already presents every charted number in
 * plain text — the DoD's own "without replacing numerical data" is
 * literally about this table remaining primary. Second, each chart's
 * own container carries `role="img"` and a text `aria-label`
 * summarizing its values directly, so a screen reader announces the
 * data even without the table — not relying on recharts' own SVG
 * output, which has no built-in accessible name.
 *
 * **"Responsive" (Requirement) uses recharts' own `ResponsiveContainer`**
 * — the same technique this library provides for exactly this
 * requirement, no custom breakpoint logic needed.
 *
 * **`isAnimationActive={false}` on every `<Bar>` (M9-027 "Audit Motion
 * and Visual Stability")** — recharts' default mount/update animation is
 * a separate, non-CSS SVG animation system that `app/globals.css`'s own
 * `prefers-reduced-motion` media query cannot reach, so it is disabled
 * directly here instead.
 */
const BAR_COLOR = 'var(--color-foreground, currentColor)';

function chartLabel(scenario: { type: 'price' | 'interest' }, index: number): string {
  return `${scenario.type === 'price' ? 'Price' : 'Interest'} Scenario ${index + 1}`;
}

function summarize(title: string, points: { name: string; value: string }[]): string {
  return `${title}: ${points.map((p) => `${p.name} ${p.value}`).join(', ')}`;
}

export function ScenarioCharts() {
  const savedScenarios = useSimulationStore((state) => state.savedScenarios);
  const comparisonSelection = useSimulationStore((state) => state.comparisonSelection);

  /**
   * Memoized (M9-039, "Optimize Rendering Behavior" — "Chart rerenders")
   * — `selected` and the 3 chart-data arrays below are derived purely
   * from `savedScenarios`/`comparisonSelection`; `useMemo` avoids
   * rebuilding them (and the recharts `<BarChart>` props that reference
   * them) on every render this component receives for an unrelated
   * reason.
   */
  const selected = useMemo(
    () => savedScenarios.filter((saved) => comparisonSelection.includes(saved.id)),
    [savedScenarios, comparisonSelection],
  );
  const equityData = useMemo(
    () =>
      selected.map((saved, index) => ({
        name: chartLabel(saved.scenario, index),
        value: saved.result.scenario.equity,
      })),
    [selected],
  );
  const healthFactorData = useMemo(
    () =>
      selected.map((saved, index) => ({
        name: chartLabel(saved.scenario, index),
        value: saved.result.scenario.healthFactor,
      })),
    [selected],
  );
  const interestData = useMemo(
    () =>
      selected.map((saved, index) => ({
        name: chartLabel(saved.scenario, index),
        value: saved.result.scenario.debtCost,
      })),
    [selected],
  );

  if (selected.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Select scenarios in Portfolio Comparison above to see charts.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="img"
        aria-label={summarize(
          'Portfolio Value',
          equityData.map((d) => ({ name: d.name, value: formatCurrency(d.value) })),
        )}
        className="h-48 w-full"
      >
        <span className="text-xs font-medium text-foreground">Portfolio Value</span>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={equityData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Bar dataKey="value" fill={BAR_COLOR} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        role="img"
        aria-label={summarize(
          'Health Factor',
          healthFactorData.map((d) => ({ name: d.name, value: formatHealthFactor(d.value) })),
        )}
        className="h-48 w-full"
      >
        <span className="text-xs font-medium text-foreground">Health Factor</span>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={healthFactorData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Bar dataKey="value" fill={BAR_COLOR} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        role="img"
        aria-label={summarize(
          'Interest Cost',
          interestData.map((d) => ({ name: d.name, value: formatCurrency(d.value) })),
        )}
        className="h-48 w-full"
      >
        <span className="text-xs font-medium text-foreground">Interest Cost</span>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={interestData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Bar dataKey="value" fill={BAR_COLOR} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        Debt and BTC exposure charts aren&rsquo;t available for saved price/interest scenarios —
        only portfolio-action scenarios record that data.
      </p>
    </div>
  );
}
