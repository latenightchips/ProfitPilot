import type { DebtAndInterestPanelData } from '../types/debtAndInterestPanel';

/**
 * Debt and Interest Panel — 06_TASKS.md M5-013. DoD: "The user can
 * understand the ongoing cost of maintaining the position." Requirement:
 * "Clearly distinguish current rate from projected assumptions."
 *
 * "Projected debt where available" is not rendered — see
 * `../types/debtAndInterestPanel.ts` for why (Conflict #7, compound
 * interest has no documented formula). The "Current Borrow Rate" label
 * itself, with no projected-rate figure anywhere in this component,
 * satisfies the distinguishing Requirement structurally — there is
 * nothing projected shown to conflate it with.
 *
 * **Formula ID tooltips (M5-028, Batch 18)**: `03_UI.md`'s own
 * cross-cutting "TOOLTIPS" rule ("Every important metric includes a
 * tooltip") was not yet satisfied here — every other Dashboard numeric
 * display either uses `KpiCard` or (like `HealthFactorStatusSection`)
 * carries a manual `title` tooltip; this panel had neither. Total Debt
 * and Annual Interest Cost are the exact same Service values `DashboardKpiGrid`
 * already tooltips (F-003, F-032); Monthly/Daily reuse
 * `calculateDebtInterestBreakdown`'s own documented F-031/F-030. Current
 * Borrow Rate is a raw stored input, not a Formula output, so it carries
 * no tooltip — consistent with how "Current market price" in
 * `LiquidationRiskPanel` is also left untooltipped. Each tooltipped
 * `<div>` carries `tabIndex={0}` — the same WCAG 2.1.1 keyboard-
 * reachability fix `HealthFactorStatusSection` and `KpiCard` already
 * apply, so a `title` this batch adds does not ship with the same gap
 * M5-024 already fixed elsewhere.
 */
export function DebtAndInterestPanel({ panel }: { panel: DebtAndInterestPanelData }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Debt and Interest</h3>

      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div title="F-003 — see docs/02_Formulas.md" tabIndex={0}>
          <div className="text-xs text-muted-foreground">Total Debt</div>
          <div className="text-base font-medium text-foreground">{panel.formattedTotalDebt}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Current Borrow Rate</div>
          <div className="text-base font-medium text-foreground">
            {panel.formattedCurrentBorrowRate}
          </div>
        </div>
        <div title="F-032 — see docs/02_Formulas.md" tabIndex={0}>
          <div className="text-xs text-muted-foreground">Annual Interest Cost</div>
          <div className="text-base font-medium text-foreground">
            {panel.formattedAnnualInterestCost}
          </div>
        </div>
        <div title="F-031 — see docs/02_Formulas.md" tabIndex={0}>
          <div className="text-xs text-muted-foreground">Monthly Interest Cost</div>
          <div className="text-base font-medium text-foreground">
            {panel.formattedMonthlyInterestCost}
          </div>
        </div>
        <div title="F-030 — see docs/02_Formulas.md" tabIndex={0}>
          <div className="text-xs text-muted-foreground">Daily Interest Cost</div>
          <div className="text-base font-medium text-foreground">
            {panel.formattedDailyInterestCost}
          </div>
        </div>
      </div>

      {panel.rateSource !== null && (
        <p className="text-xs text-muted-foreground">Rate source: {panel.rateSource}</p>
      )}
    </div>
  );
}
