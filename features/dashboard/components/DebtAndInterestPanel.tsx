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
 */
export function DebtAndInterestPanel({ panel }: { panel: DebtAndInterestPanelData }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Debt and Interest</h3>

      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <div className="text-xs text-muted-foreground">Total Debt</div>
          <div className="text-base font-medium text-foreground">{panel.formattedTotalDebt}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Current Borrow Rate</div>
          <div className="text-base font-medium text-foreground">
            {panel.formattedCurrentBorrowRate}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Annual Interest Cost</div>
          <div className="text-base font-medium text-foreground">
            {panel.formattedAnnualInterestCost}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Monthly Interest Cost</div>
          <div className="text-base font-medium text-foreground">
            {panel.formattedMonthlyInterestCost}
          </div>
        </div>
        <div>
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
