import type { LiquidationRiskPanelData } from '../types/liquidationRiskPanel';
import { KpiCard } from './KpiCard';

/**
 * Liquidation Risk Panel — 06_TASKS.md M5-009. DoD: "The section clearly
 * distinguishes current values from calculated estimates."
 *
 * Satisfied structurally, not just by wording: "Current market price" —
 * a genuinely current value, not derived from any formula — is its own
 * labeled "Current" group, visually and semantically separate from the
 * "Calculated Estimates" group (liquidation price/distance/decline, plus
 * the two target-safety actions), which reuses `KpiCard` (M5-005) for
 * the same tooltip/status/"clearly unavailable" treatment
 * `DashboardKpiGrid` (M5-006) already established, for visual
 * consistency across every Dashboard KPI-style value.
 */
export function LiquidationRiskPanel({ panel }: { panel: LiquidationRiskPanelData }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Liquidation Risk</h3>

      <div>
        <p className="text-xs text-muted-foreground">Current</p>
        <p className="text-base font-medium text-foreground">{panel.currentMarketPrice ?? '—'}</p>
      </div>

      <div>
        <p className="mb-2 text-xs text-muted-foreground">Calculated Estimates</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            title="Estimated Liquidation Price"
            primaryValue={panel.estimatedLiquidationPrice.formattedValue}
            status={panel.estimatedLiquidationPrice.status}
            tooltip={
              panel.estimatedLiquidationPrice.formulaId !== null
                ? `${panel.estimatedLiquidationPrice.formulaId} — see docs/02_Formulas.md`
                : undefined
            }
          />
          <KpiCard
            title="Distance to Liquidation"
            primaryValue={panel.liquidationDistance.formattedValue}
            status={panel.liquidationDistance.status}
            tooltip={
              panel.liquidationDistance.formulaId !== null
                ? `${panel.liquidationDistance.formulaId} — see docs/02_Formulas.md`
                : undefined
            }
          />
          <KpiCard
            title="Percentage Decline to Liquidation"
            primaryValue={panel.percentageDeclineToLiquidation.formattedValue}
            status={panel.percentageDeclineToLiquidation.status}
            tooltip={
              panel.percentageDeclineToLiquidation.formulaId !== null
                ? `${panel.percentageDeclineToLiquidation.formulaId} — see docs/02_Formulas.md`
                : undefined
            }
          />
        </div>
      </div>

      {(panel.debtRepaymentRequired !== null || panel.collateralAdditionRequired !== null) && (
        <div className="text-sm text-muted-foreground">
          {panel.debtRepaymentRequired !== null && (
            <p>Debt repayment required for target safety: {panel.debtRepaymentRequired}</p>
          )}
          {panel.collateralAdditionRequired !== null && (
            <p>
              Collateral addition required for target safety: {panel.collateralAdditionRequired}
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{panel.assumptions}</p>
    </div>
  );
}
