import type { LeverageSummary } from '../types/leverageSummary';

/**
 * Leverage Summary Section — 06_TASKS.md M5-014. DoD: "The section
 * explains leverage without requiring advanced financial knowledge."
 *
 * "Debt-to-equity ratio" is not rendered — see `../types/leverageSummary.ts`
 * for why (the same "no Formula ID" reason M2-008 already skipped it
 * for at the Engine layer, carried forward unchanged).
 *
 * **Formula ID tooltips (M5-028, Batch 18)**: `03_UI.md`'s own
 * cross-cutting "TOOLTIPS" rule ("Every important metric includes a
 * tooltip") was not yet satisfied here. Every value below is the exact
 * same Service output `DashboardKpiGrid` already tooltips, under a
 * second, differently-worded label (`buildLeverageSummary.ts`'s own
 * header comment already documents this): Gross Exposure and Effective
 * BTC Exposure are both `summary.collateralValue` (F-002, "Total
 * Collateral"); Net Equity is `summary.netEquity` (F-004, "Net Portfolio
 * Value"); Leverage Ratio is `summary.leverage` (F-011, "Effective
 * Leverage"). Each tooltipped `<div>` carries `tabIndex={0}` — the same
 * WCAG 2.1.1 keyboard-reachability fix `HealthFactorStatusSection` and
 * `KpiCard` already apply.
 */
export function LeverageSummarySection({ summary }: { summary: LeverageSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Leverage Summary</h3>

      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div title="F-002 — see docs/02_Formulas.md" tabIndex={0}>
          <div className="text-xs text-muted-foreground">Gross Exposure</div>
          <div className="text-base font-medium text-foreground">
            {summary.formattedGrossExposure}
          </div>
        </div>
        <div title="F-004 — see docs/02_Formulas.md" tabIndex={0}>
          <div className="text-xs text-muted-foreground">Net Equity</div>
          <div className="text-base font-medium text-foreground">{summary.formattedNetEquity}</div>
        </div>
        <div title="F-011 — see docs/02_Formulas.md" tabIndex={0}>
          <div className="text-xs text-muted-foreground">Leverage Ratio</div>
          <div className="text-base font-medium text-foreground">
            {summary.formattedLeverageRatio}
          </div>
        </div>
        <div title="F-002 — see docs/02_Formulas.md" tabIndex={0}>
          <div className="text-xs text-muted-foreground">Effective BTC Exposure</div>
          <div className="text-base font-medium text-foreground">
            {summary.formattedEffectiveBtcExposure}
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{summary.explanation}</p>
    </div>
  );
}
