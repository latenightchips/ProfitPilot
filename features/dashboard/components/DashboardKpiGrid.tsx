import type { DashboardMetric, DashboardMetrics } from '../types/viewModel';
import { buildKpiDeveloperDetails } from '../utils/buildKpiDeveloperDetails';
import { KpiCard } from './KpiCard';

/**
 * Core KPI Grid — 06_TASKS.md M5-006 ("Implement Core KPI Grid").
 * Dependencies: M5-003, M5-005. DoD: "Every critical portfolio metric is
 * visible without scrolling excessively on desktop."
 *
 * Renders exactly this task's own "Cards" list, in its own order — Net
 * portfolio value, Total collateral, Total debt, Current Health Factor,
 * Current LTV, Effective leverage, Annual interest cost, Liquidation
 * price. `DashboardMetrics` (M5-003) also carries `liquidationDistance`/
 * `liquidationBuffer`, which this task's own list does not name — left
 * out of this grid (not deleted from the view model) since M5-009
 * ("Implement Liquidation Risk Panel") explicitly names "Distance to
 * Liquidation"/"Buffer" as its own dedicated section's content, a
 * different, later, still-unbuilt task.
 *
 * Requirements addressed:
 * - **"Use Service outputs only"**: every `primaryValue` is a
 *   `DashboardMetric.formattedValue`, itself only ever derived from
 *   `PortfolioSummary` (M5-003's own guarantee) — nothing computed here.
 * - **"Use consistent formatting"**: reuses the same `formattedValue`
 *   strings the Summary Header and every other Dashboard surface already
 *   read from the same view model — one formatting layer, not a second
 *   one for this grid.
 * - **"Display unavailable values clearly"**: `DashboardMetric.status`
 *   (`'ok' | 'unavailable'`, M5-003) maps directly to `KpiCard`'s own
 *   `status` prop, which renders a visible "Unavailable" label — not
 *   just a blank or dashed value.
 *
 * Tooltip content is each metric's own Formula ID (already documented,
 * not invented — see `../types/viewModel.ts`).
 *
 * **`developerMode` prop (Batch 14, M5-022, "Implement Dashboard
 * Developer Mode")**: when `true`, each card's `developerModeDetails`
 * slot (added M5-005, unused until now) shows that metric's own Formula
 * ID, raw (unformatted) value, and the calculation's Engine/Formula
 * version — see `../utils/buildKpiDeveloperDetails.ts` for why only
 * these two items are genuinely new, gated content.
 */
function toKpiCardProps(
  metric: DashboardMetric,
  developerMode: boolean,
  engineVersion: string,
  formulaVersion: string,
) {
  return {
    title: metric.label,
    primaryValue: metric.formattedValue,
    status: metric.status,
    tooltip:
      metric.formulaId !== null ? `${metric.formulaId} — see docs/02_Formulas.md` : undefined,
    developerModeDetails: developerMode
      ? buildKpiDeveloperDetails(metric, engineVersion, formulaVersion)
      : undefined,
  };
}

export function DashboardKpiGrid({
  metrics,
  developerMode = false,
  engineVersion = '',
  formulaVersion = '',
}: {
  metrics: DashboardMetrics;
  developerMode?: boolean;
  engineVersion?: string;
  formulaVersion?: string;
}) {
  const cards: DashboardMetric[] = [
    metrics.netPortfolioValue,
    metrics.totalCollateral,
    metrics.totalDebt,
    metrics.healthFactor,
    metrics.loanToValue,
    metrics.leverage,
    metrics.annualInterestCost,
    metrics.liquidationPrice,
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((metric) => (
        <KpiCard
          key={metric.label}
          {...toKpiCardProps(metric, developerMode, engineVersion, formulaVersion)}
        />
      ))}
    </div>
  );
}
