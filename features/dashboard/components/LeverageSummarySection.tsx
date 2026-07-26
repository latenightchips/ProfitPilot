import type { LeverageSummary } from '../types/leverageSummary';

/**
 * Leverage Summary Section — 06_TASKS.md M5-014. DoD: "The section
 * explains leverage without requiring advanced financial knowledge."
 *
 * "Debt-to-equity ratio" is not rendered — see `../types/leverageSummary.ts`
 * for why (the same "no Formula ID" reason M2-008 already skipped it
 * for at the Engine layer, carried forward unchanged).
 */
export function LeverageSummarySection({ summary }: { summary: LeverageSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Leverage Summary</h3>

      <div className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <div className="text-xs text-muted-foreground">Gross Exposure</div>
          <div className="text-base font-medium text-foreground">
            {summary.formattedGrossExposure}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Net Equity</div>
          <div className="text-base font-medium text-foreground">{summary.formattedNetEquity}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Leverage Ratio</div>
          <div className="text-base font-medium text-foreground">
            {summary.formattedLeverageRatio}
          </div>
        </div>
        <div>
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
