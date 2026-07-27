/**
 * Portfolio Summary export — 06_TASKS.md M5-016 ("Implement Dashboard
 * Quick Actions"), "Export portfolio" Action item. Builds on 03_UI.md's
 * own "PAGE ACTIONS" ("Export Portfolio") and "EXPORT OPTIONS" sections:
 * "Users may export Portfolio Summary as CSV, JSON [PDF is a documented
 * Future Version item, not built]. Exports include calculation
 * timestamps."
 *
 * **Distinct from, not a duplicate of, M4-017's `downloadPortfolioRecoveryCopy`
 * (`utils/portfolioRecoveryExport.ts`).** That export is a narrow,
 * error-recovery-specific dump of the portfolio's own *raw entered*
 * fields, used only when a calculation has failed and there is nothing
 * calculated to export. This export is the opposite case — 03_UI.md's
 * "Portfolio Summary" export, containing the already-*calculated*
 * `DashboardMetrics` (the same 10 values already shown in
 * `DashboardKpiGrid`/`LiquidationRiskPanel`), which by definition
 * requires a successful calculation to exist. Reusing the recovery
 * copy's shape here would either fabricate calculated fields that do not
 * exist, or silently omit "Exports include calculation timestamps" —
 * this module exists instead of extending that one.
 *
 * **Values, not a new calculation.** Every exported figure is a
 * `DashboardMetric.formattedValue` already produced by
 * `buildDashboardViewModel` (M5-003) — this module only serializes
 * already-formatted display strings into CSV/JSON, the same "view layer,
 * not a calculator" boundary every other Dashboard export/format module
 * in this codebase observes. Raw (unformatted) values are deliberately
 * not included: 04_BUILD_GUIDE.md's own "IMPORT / EXPORT DIRECTORY"
 * describes a separate, unassigned `services/export/` Service (CSV/PDF
 * exporters, a machine-reimportable schema) — no task assigns building
 * that infrastructure, so this stays a human-readable snapshot, not a
 * reimport format.
 *
 * **`schemaVersion` reuses `PORTFOLIO_RECOVERY_SCHEMA_VERSION`** — the
 * same Version 0.1 schema tag `01_PRD.md`'s "BACKUP & RECOVERY" section
 * requires ("Every export should include schema versioning"), applying
 * app-wide, not only to the recovery-copy export.
 */
import { PORTFOLIO_RECOVERY_SCHEMA_VERSION } from '@/utils/portfolioRecoveryExport';

import type { DashboardMetrics } from '../types/viewModel';

interface MetricRow {
  label: string;
  value: string;
}

function toMetricRows(metrics: DashboardMetrics): MetricRow[] {
  return [
    { label: metrics.netPortfolioValue.label, value: metrics.netPortfolioValue.formattedValue },
    { label: metrics.totalCollateral.label, value: metrics.totalCollateral.formattedValue },
    { label: metrics.totalDebt.label, value: metrics.totalDebt.formattedValue },
    { label: metrics.healthFactor.label, value: metrics.healthFactor.formattedValue },
    { label: metrics.loanToValue.label, value: metrics.loanToValue.formattedValue },
    { label: metrics.leverage.label, value: metrics.leverage.formattedValue },
    { label: metrics.annualInterestCost.label, value: metrics.annualInterestCost.formattedValue },
    { label: metrics.liquidationPrice.label, value: metrics.liquidationPrice.formattedValue },
    { label: metrics.liquidationDistance.label, value: metrics.liquidationDistance.formattedValue },
    { label: metrics.liquidationBuffer.label, value: metrics.liquidationBuffer.formattedValue },
  ];
}

export interface PortfolioSummaryExport {
  schemaVersion: string;
  exportedAt: string;
  portfolioName: string;
  calculationTimestamp: string;
  metrics: MetricRow[];
}

export function buildPortfolioSummaryExport(
  portfolioName: string,
  calculationTimestamp: string,
  metrics: DashboardMetrics,
): PortfolioSummaryExport {
  return {
    schemaVersion: PORTFOLIO_RECOVERY_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    portfolioName,
    calculationTimestamp,
    metrics: toMetricRows(metrics),
  };
}

function triggerDownload(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadPortfolioSummaryJson(
  portfolioId: string,
  portfolioName: string,
  calculationTimestamp: string,
  metrics: DashboardMetrics,
): void {
  const data = buildPortfolioSummaryExport(portfolioName, calculationTimestamp, metrics);
  triggerDownload(
    JSON.stringify(data, null, 2),
    'application/json',
    `portfolio-${portfolioId}-summary.json`,
  );
}

/** Quotes every field and escapes embedded quotes — RFC 4180, no CSV library dependency. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildPortfolioSummaryCsv(
  portfolioName: string,
  calculationTimestamp: string,
  metrics: DashboardMetrics,
): string {
  const rows = [
    ['Portfolio', portfolioName],
    ['Calculated', calculationTimestamp],
    [],
    ['Metric', 'Value'],
    ...toMetricRows(metrics).map((row) => [row.label, row.value]),
  ];
  return rows.map((row) => row.map(csvField).join(',')).join('\r\n');
}

export function downloadPortfolioSummaryCsv(
  portfolioId: string,
  portfolioName: string,
  calculationTimestamp: string,
  metrics: DashboardMetrics,
): void {
  const csv = buildPortfolioSummaryCsv(portfolioName, calculationTimestamp, metrics);
  triggerDownload(csv, 'text/csv', `portfolio-${portfolioId}-summary.csv`);
}
