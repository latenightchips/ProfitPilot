import type { ServiceMetadata } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import { formatCurrency, formatDateTime, formatPercent } from './format';

/**
 * Shared Strategy Assumptions Panel — 06_TASKS.md M7-004 ("Create
 * Shared Strategy Assumptions Panel"). Dependencies: M7-002. Priority
 * P1, Effort S. Display: "Market price, Protocol parameters, Borrow
 * rate, Fees, Slippage, Gas estimate, Time horizon, Manual-data status,
 * Formula version." DoD: "Users can inspect the assumptions behind
 * every strategy result."
 *
 * **Directly generalizes `features/simulation/components/
 * SimulationAssumptions.tsx` (M6-013)** — same Market
 * price/Protocol-parameters/Formula-version content and rendering
 * shape, reused here as the shared version both Loop Builder and Exit
 * Planner will render, per M7-004's own DoD ("shared" in the task
 * title, the same explicit-exception reasoning `types/strategy.ts`'s
 * header comment documents).
 *
 * **"Borrow rate" is shown as its own line, distinct from "Protocol
 * parameters," per M7-004's own literal Display list — even though it
 * duplicates `protocol.borrowApr` shown one line above it.** No
 * Loop-specific "Borrow-rate assumption" override exists yet (that
 * input is M7-008's own, not built until Batch 2) — once it exists,
 * this line is where an active override will diverge from the
 * portfolio's own configured rate, the same "two numbers that can
 * differ" pattern `SimulationAssumptions.tsx`'s own "Rate Assumptions"
 * vs. "Protocol Parameters" distinction already established for
 * Simulation. Until then the two lines are honestly identical, not
 * merged, so this component's shape doesn't need to change once an
 * override exists.
 *
 * **"Fees," "Slippage," and "Gas estimate" are a structural, permanent
 * gap — the same conflict #8 pattern `SimulationAssumptions.tsx`
 * already documents for its own "Fees & Slippage" line, extended here
 * to also name Gas estimate explicitly** (Simulation had no Gas
 * estimate Display item of its own to name). No Formula ID or equation
 * for any of the three exists anywhere in `02_Formulas.md`.
 *
 * **"Time horizon" has no universal shape across tools** — Loop
 * Builder has no documented time-horizon input anywhere in M7-008's own
 * Inputs list; Exit Planner's M7-022 names an *optional* "Target Date."
 * Rather than inventing a shared time-horizon concept neither task
 * actually asks for, this component accepts `timeHorizonLabel` as an
 * already-formatted string the caller supplies (or `null` to omit the
 * row entirely) — each tool decides its own meaning, this component
 * only renders it.
 *
 * **"Manual-data status" is new — `SimulationAssumptions.tsx` never
 * built it.** Reuses `Portfolio.marketUpdatedAt` (M4-001) directly and
 * the exact same Manual Mode framing
 * `features/dashboard/utils/buildDataFreshnessIndicators.ts`'s own
 * `REFRESH_NOTE` already established (M5-017) — this application has no
 * live data provider connected, so every assumption reflects the values
 * the user last entered, not a fetched quote. Shown as a plain
 * timestamp + note rather than reusing Dashboard's own fresh/stale
 * classification machinery (`DataFreshnessIndicators`), which is
 * Dashboard-Store-specific and not a shared type this milestone's own
 * M7-002 asked for.
 */
export function StrategyAssumptionsPanel({
  portfolio,
  metadata,
  timeHorizonLabel,
}: {
  portfolio: Portfolio;
  metadata: ServiceMetadata | null;
  timeHorizonLabel: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Market Price</span>
        <span className="text-muted-foreground">
          {formatCurrency(portfolio.market.btcPriceUsd)}
        </span>
      </div>

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
        <span className="text-xs font-medium text-foreground">Borrow Rate</span>
        <span className="text-muted-foreground">{formatPercent(portfolio.protocol.borrowApr)}</span>
      </div>

      {timeHorizonLabel !== null && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-foreground">Time Horizon</span>
          <span className="text-muted-foreground">{timeHorizonLabel}</span>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">
          Fees, Slippage &amp; Gas Estimate
        </span>
        <span className="text-muted-foreground">
          Estimated fees, slippage, and gas costs are not included.
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Manual-Data Status</span>
        <span className="text-muted-foreground">
          Manual Mode — reflects the values you last entered, updated{' '}
          {formatDateTime(portfolio.marketUpdatedAt)}. No live data provider is connected.
        </span>
      </div>

      {metadata !== null && (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <span className="text-xs font-medium text-foreground">Formula Version</span>
          <span className="text-muted-foreground">
            Engine {metadata.engineVersion} · Formula {metadata.formulaVersion}
          </span>
        </div>
      )}
    </div>
  );
}
