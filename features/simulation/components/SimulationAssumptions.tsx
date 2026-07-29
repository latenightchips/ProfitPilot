'use client';

import type { ApplicationPortfolio, PriceScenarioInput } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

import { formatCurrency } from '../utils/format';

/**
 * Simulation Assumptions Panel — 06_TASKS.md M6-013 ("Implement
 * Simulation Assumptions Panel"). Dependencies: M6-009. Priority P0,
 * Effort S. Description: "Display all assumptions used." Include:
 * "Price assumptions, Rate assumptions, Protocol parameters, Fees,
 * Slippage, Formula version." DoD: "Every simulation is fully
 * transparent." Directly implements `01_PRD.md`'s own Principle Two
 * ("Transparency" — "Every displayed number must have a documented
 * origin... Which assumptions were used?"). No dedicated "Assumptions
 * Panel" mockup exists in `03_UI.md` Page 5 (only passing mentions —
 * "Modify simulation assumptions" for Scenario Controls, "Exports
 * include all simulation assumptions" for a future Export feature) —
 * `06_TASKS.md`'s own literal Include list is the sole source of truth
 * for this component's content, the same precedent `ScenarioCharts.tsx`
 * (Batch 10) already established for an un-mocked task.
 *
 * **Renders whenever either simulation result exists** —
 * `currentResult` (price/interest scenarios) or `portfolioActionPreview`
 * (collateral/debt changes) — matching the DoD's own "Every simulation,"
 * not just price/interest ones.
 *
 * **"Price assumptions"**: for `currentResult`, echoes the real
 * `assumptions.priceScenario` the caller supplied (`SimulationResult`'s
 * own "preserve assumptions" field, `services/simulation/scenario.ts`) —
 * an absolute price or a percentage change, exactly as entered, never
 * recomputed. A portfolio action has no price scenario at all (it uses
 * the portfolio's own current market price unmodified); that case is
 * labeled explicitly rather than showing a misleading blank or a
 * fabricated "N/A".
 *
 * **"Rate assumptions"**: only rendered for an active `type: 'interest'`
 * scenario, showing the exact simulated Borrow APR and time horizon —
 * deliberately distinct from "Protocol Parameters" below, which always
 * shows the portfolio's own currently configured Borrow APR (these two
 * can differ, since Borrow Rate is a user-editable Scenario Builder
 * field, Batch 6). For a price scenario or portfolio action, no
 * separate rate is assumed beyond the protocol's own configured value,
 * so this row is omitted rather than duplicating Protocol Parameters.
 *
 * **"Protocol parameters"**: always shown, reading directly from the
 * `portfolio.protocol` prop (Max LTV, Liquidation Threshold, Borrow APR,
 * Supply APR) — real, already-validated values, no Engine call needed.
 *
 * **"Fees" and "Slippage" are a structural, permanent gap, not a
 * "sometimes" one — the same conflict #8 pattern `engine/loop/
 * calculateLoopCosts.ts` and `engine/exit/calculateExitPosition.ts`
 * already established and documented.** No Formula ID or equation for
 * swap fees or slippage exists anywhere in `02_Formulas.md` (confirmed
 * by grep before implementation) — inventing a fee/slippage model here
 * would violate "do not invent formulas." Documented explicitly with
 * the same wording those two Engine functions already use, rather than
 * silently omitted or shown as a fabricated `$0`.
 *
 * **"Formula version"**: reads `stores/simulationStore.ts`'s own new
 * `lastMetadata` field (Batch 12) — the real `ServiceMetadata.engineVersion`/
 * `formulaVersion` the most recent successful calculation actually
 * returned, not a hardcoded constant duplicated in the UI layer.
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatPriceScenario(priceScenario: PriceScenarioInput): string {
  if (priceScenario.type === 'absolute') {
    return formatCurrency(priceScenario.btcPriceUsd);
  }
  const sign = priceScenario.percentageChange >= 0 ? '+' : '';
  return `${sign}${formatPercent(priceScenario.percentageChange)}`;
}

export function SimulationAssumptions({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const currentResult = useSimulationStore((state) => state.currentResult);
  const portfolioActionPreview = useSimulationStore((state) => state.portfolioActionPreview);
  const lastMetadata = useSimulationStore((state) => state.lastMetadata);

  if (currentResult === null && portfolioActionPreview === null) {
    return (
      <p className="text-sm text-muted-foreground">Run a simulation to see its assumptions.</p>
    );
  }

  const priceAssumption =
    currentResult !== null
      ? formatPriceScenario(currentResult.assumptions.priceScenario)
      : `${formatCurrency(portfolio.market.btcPriceUsd)} (current, unmodified)`;

  const rateAssumption =
    currentResult !== null && currentResult.assumptions.type === 'interest'
      ? `${formatPercent(currentResult.assumptions.borrowApr)} over ${currentResult.assumptions.timeHorizonDays} days`
      : null;

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Price Assumptions</span>
        <span className="text-muted-foreground">{priceAssumption}</span>
      </div>

      {rateAssumption !== null && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">Rate Assumptions</span>
          <span className="text-muted-foreground">{rateAssumption}</span>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Protocol Parameters</span>
        <span className="text-muted-foreground">
          Max LTV {formatPercent(portfolio.protocol.maxLoanToValue)} · Liquidation Threshold{' '}
          {formatPercent(portfolio.protocol.liquidationThreshold)} · Borrow APR{' '}
          {formatPercent(portfolio.protocol.borrowApr)} · Supply APR{' '}
          {formatPercent(portfolio.protocol.supplyApr)}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Fees &amp; Slippage</span>
        <span className="text-muted-foreground">
          Not included — no Formula ID or equation for swap fees or slippage exists in
          02_Formulas.md.
        </span>
      </div>

      {lastMetadata !== null && (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <span className="text-xs font-medium text-foreground">Formula Version</span>
          <span className="text-muted-foreground">
            Engine {lastMetadata.engineVersion} · Formula {lastMetadata.formulaVersion}
          </span>
        </div>
      )}
    </div>
  );
}
