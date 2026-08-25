'use client';

import {
  type ApplicationPortfolio,
  type PriceScenarioInput,
  resolveRiskCapacityDisplay,
  resolveSupplyAprDisplay,
} from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

import { formatCurrency } from '../utils/format';
import { resolveEffectiveBorrowRate } from '../utils/resolveEffectiveBorrowRate';

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
 * **"Protocol parameters"**: always shown — Supply APR resolves via
 * `resolveSupplyAprDisplay` (V4 Readiness Audit §12 P1-1: unconditional
 * `portfolio.protocol.supplyApr` for V3, "Not available" for a live V4
 * portfolio with no authoritative V4 supply rate — see that function's
 * own doc comment); the risk-capacity line (Max LTV/Liquidation Threshold
 * for V3, Collateral Factor for V4) is protocol-version-dispatched — see
 * the V4 Readiness Audit §12 Stage 23E note below.
 *
 * **Borrow APR here is protocol-version-dispatched — V4 Readiness Audit
 * §12 Stage 20.** Previously always `portfolio.protocol.borrowApr`, a
 * legacy V3-shaped scalar shown for V4 too even though it has no
 * relationship to a V4 position's real, synced rate. Now
 * `resolveEffectiveBorrowRate` (V3: unchanged; V4: the canonical,
 * blended `deriveAaveV4EffectiveBorrowRate` value) — "Not available"
 * rather than a fabricated or stale V3 number when V4 state hasn't
 * synced yet. **This is the BLENDED "effective borrow rate," not the raw
 * `AaveV4DebtState.baseDrawnApr`** — see `resolveEffectiveBorrowRate.ts`'s
 * own header comment for why the two must never be confused; this
 * component only ever displays the blended one, never feeds it back into
 * a `v4RateStress` calculation.
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
 *
 * **V4 Readiness Audit §12 Stage 23E** — the risk-capacity line of
 * "Protocol Parameters" previously always showed
 * `portfolio.protocol.maxLoanToValue`/`.liquidationThreshold`
 * unconditionally, a meaningless V3 pair for a V4 portfolio (Stage 23B:
 * `collateralFactor` alone governs both). Now resolved via the shared
 * `resolveRiskCapacityDisplay` (`services/portfolio/mapping.ts`) rather
 * than reading `portfolio.protocol.*` directly — V3 unchanged, V4 shows
 * "Collateral Factor" (or "Not available" when `v4CollateralRisk` has not
 * synced yet), never a reinterpreted V3 field.
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

  const effectiveBorrowApr = resolveEffectiveBorrowRate(portfolio);
  // "Max LTV"/"Liquidation Threshold" vs. "Collateral Factor" — V4
  // Readiness Audit §12 Stage 23E. See `resolveRiskCapacityDisplay`'s own
  // doc comment (`services/portfolio/mapping.ts`) for the full reasoning:
  // V4 has no separate max-LTV/liquidation-threshold pair.
  const riskCapacityDisplay = resolveRiskCapacityDisplay(portfolio);
  const riskCapacityText =
    riskCapacityDisplay.kind === 'v3'
      ? `Max LTV ${formatPercent(riskCapacityDisplay.maxLoanToValue)} · Liquidation Threshold ${formatPercent(riskCapacityDisplay.liquidationThreshold)}`
      : riskCapacityDisplay.kind === 'v4Available'
        ? `Collateral Factor ${formatPercent(riskCapacityDisplay.collateralFactor)}`
        : 'Collateral Factor Not available';
  // "Supply APR" — V4 Readiness Audit §12 P1-1. See
  // `resolveSupplyAprDisplay`'s own doc comment (`services/portfolio/mapping.ts`):
  // no V4 boundary this codebase talks to exposes an authoritative supply
  // rate, so a live V4 portfolio never shows a stale/fabricated number
  // here.
  const supplyAprDisplay = resolveSupplyAprDisplay(portfolio);
  const supplyAprText =
    supplyAprDisplay.kind === 'available'
      ? formatPercent(supplyAprDisplay.supplyApr)
      : 'Not available';

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
          {riskCapacityText} · Borrow APR{' '}
          {effectiveBorrowApr !== null ? formatPercent(effectiveBorrowApr) : 'Not available'} ·
          Supply APR {supplyAprText}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Fees &amp; Slippage</span>
        <span className="text-muted-foreground">
          Estimated swap fees and slippage are not included.
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
