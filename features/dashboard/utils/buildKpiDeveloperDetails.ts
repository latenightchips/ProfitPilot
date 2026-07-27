/**
 * KPI Developer Mode details builder — 06_TASKS.md M5-022. See
 * `features/dashboard/components/DeveloperModeToggle.tsx` for the full
 * design reasoning (where the toggle state lives, why a new Store).
 *
 * Feeds `KpiCard`'s own `developerModeDetails` slot (added M5-005,
 * unused until this batch). Only "Raw values" and "Formula IDs" are
 * genuinely new, Developer-Mode-gated content — "Assumptions,"
 * "Warnings," and "Calculation timestamp" (M5-022's other three
 * "Display where appropriate" items) are already visible to every user
 * today, not gated behind this toggle: `LiquidationRiskPanel`'s own
 * `assumptions` line (M5-009), `RiskWarningBanner`'s own
 * `calculationWarnings` case (M5-010, reads `DashboardViewModelOk.warnings`
 * directly), and the "Calculated {timestamp}" line above the KPI grid
 * (`app/page.tsx`, M5-001) all already show this information
 * unconditionally — moving them behind a toggle would be a regression
 * (hiding information from normal users), not this task's intent
 * ("Advanced information is available *without cluttering* the default
 * experience," not "without informing" it). "Engine version"/"Formula
 * version" are genuinely new and shared across every metric (the whole
 * calculation is one Service call), so they are appended to every
 * per-metric detail string rather than shown once in a separate element.
 *
 * Returns `undefined` (KpiCard renders nothing) when the metric itself
 * has no `formulaId` — an unavailable metric (e.g. the zero-debt
 * liquidation trio) has no formula-specific detail to elaborate on.
 */
import type { DashboardMetric } from '../types/viewModel';

export function buildKpiDeveloperDetails(
  metric: DashboardMetric,
  engineVersion: string,
  formulaVersion: string,
): string | undefined {
  if (metric.formulaId === null) return undefined;

  return [
    `Formula ID: ${metric.formulaId}`,
    `Raw value: ${metric.rawValue ?? 'N/A'}`,
    `Engine v${engineVersion}, Formula v${formulaVersion}`,
  ].join(' · ');
}
