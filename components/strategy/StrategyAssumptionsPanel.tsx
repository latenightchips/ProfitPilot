import { V4ProvenanceDetail } from '@/components/aave/V4ProvenanceDetail';
import {
  resolveRiskCapacityDisplay,
  resolveSupplyAprDisplay,
  type ServiceMetadata,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';
import type { ProtocolStatusKind } from '@/utils/protocolStatus';
import { resolveManualDataStatusText } from '@/utils/protocolStatus';

import { formatCurrency, formatDateTime, formatPercent } from './format';
import { resolveEffectiveBorrowRate } from './resolveEffectiveBorrowRate';

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
 * **"Fees," "Slippage," and "Gas estimate" — V4 Readiness Audit §12
 * P1-6, resolving conflict #8.** Reads `portfolio.settings.executionCostAssumptions`
 * directly (this component already receives the full `Portfolio`, unlike
 * most Loop/Exit components which only get `ApplicationPortfolio`) and
 * shows each of the three configured values, clearly labeled as
 * assumptions, not live quotes — "Not configured" for whichever is
 * absent, never a fabricated default. This panel shows the portfolio's
 * own CONFIGURED inputs; the resulting COMPUTED dollar costs for a
 * specific strategy/exit are shown by `LoopCostAnalysis.tsx`/
 * `FullExitResult.tsx`/`PartialExitResult.tsx` instead, not duplicated
 * here.
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
 *
 * **V4 Readiness Audit §12 Stage 21** — two fixes, both protocol-aware via
 * the existing `portfolio` prop plus one new optional prop, V3 behavior
 * unchanged either way:
 *
 * 1. Both "Borrow APR" (inside Protocol Parameters) and "Borrow Rate" now
 *    go through `resolveEffectiveBorrowRate` (`./resolveEffectiveBorrowRate.ts`)
 *    instead of reading `portfolio.protocol.borrowApr` directly. For a V3
 *    portfolio this returns the exact same scalar, so the rendered text is
 *    byte-identical. For a V4 portfolio it returns the canonical blended
 *    effective rate (`deriveAaveV4EffectiveBorrowRate`), never the raw V3
 *    field, and "Not available" rather than a fabricated or stale number
 *    when the canonical rate cannot yet be derived.
 * 2. "Manual-Data Status" now accepts an optional `protocolStatus` prop
 *    (`ProtocolStatusKind`, `@/utils/protocolStatus`) rather than owning
 *    any live/freshness logic itself — this component stays free of
 *    Zustand, per the same "panel is a pure view, caller supplies
 *    already-computed state" boundary `SimulationAssumptions.tsx` and
 *    `DashboardSummaryHeader` already establish for the same status kind.
 *    A V4 status renders via `formatProtocolStatus`, so a user on a
 *    live-synced V4 portfolio sees real Live/Stale/Loading/Provider-error/
 *    Missing-debt-state status rather than a copy that always claims "No
 *    live data provider is connected" regardless of protocol.
 *
 *    **V1.1 Batch 6 ("Data Freshness & Live-Status UX") — a V3
 *    `protocolStatus` is no longer discarded.** Before this batch, an
 *    explicit `{ version: 'v3', ... }` status rendered the exact same
 *    static "Manual Mode... No live data provider is connected" copy as
 *    `undefined` — a real inconsistency with `PortfolioPageClient.tsx`'s
 *    own "Stage 25B" fix for its local Collateral/Debt badges, which
 *    already switched to real V3 live/stale/unavailable text via this
 *    exact `deriveProtocolStatus`/`formatProtocolStatus` pair. A user on
 *    Loop Builder or Exit Planner with a genuinely live-synced Aave V3
 *    portfolio was being told no live provider was connected, which was
 *    false. Now delegates to the shared `resolveManualDataStatusText`
 *    (`@/utils/protocolStatus`) for all three cases: a supplied
 *    `protocolStatus` (V3 or V4) always renders its real text; with none
 *    supplied, a portfolio whose `marketSource` is already `'live'` (live-
 *    synced on a different page, e.g. `SimulationPageClient`, which
 *    deliberately never mounts V3 sync itself) says so truthfully instead
 *    of claiming no provider is connected; only a genuinely manual
 *    portfolio keeps the original copy.
 *
 * **V4 Readiness Audit §12 Stage 23E** — "Protocol Parameters" previously
 * always showed `portfolio.protocol.maxLoanToValue`/`.liquidationThreshold`
 * unconditionally — a meaningless V3 pair for a V4 portfolio, since V4 has
 * no such pair at all (Stage 23B: `collateralFactor` alone governs both
 * borrow capacity and liquidation eligibility). Now resolved via the
 * shared `resolveRiskCapacityDisplay` (`services/portfolio/mapping.ts`,
 * the same canonical Service-layer dispatch `calculatePortfolioSummary`
 * itself uses) rather than reading `portfolio.protocol.*` directly — V3
 * unchanged, V4 shows "Collateral Factor" (or "Not available" when
 * `v4CollateralRisk` has not synced yet), never a reinterpreted V3 field.
 */
export function StrategyAssumptionsPanel({
  portfolio,
  metadata,
  timeHorizonLabel,
  protocolStatus,
}: {
  portfolio: Portfolio;
  metadata: ServiceMetadata | null;
  timeHorizonLabel: string | null;
  protocolStatus?: ProtocolStatusKind;
}) {
  const effectiveBorrowApr = resolveEffectiveBorrowRate(portfolio);
  const borrowAprDisplay =
    effectiveBorrowApr !== null ? formatPercent(effectiveBorrowApr) : 'Not available';
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
  // "Supply APR" — Supply APR Semantic-Boundary Fix, superseding V4
  // Readiness Audit §12 P1-1. `resolveSupplyAprDisplay` now reports
  // `'not-applicable'` for every V4 portfolio unconditionally (see its own
  // doc comment, `services/portfolio/mapping.ts`) — V4 Supply APR is not
  // a value that could become available later (unlike Collateral Factor
  // pending sync, shown as "Not available" just above), so this segment
  // is omitted from the line entirely for V4 rather than reusing that
  // same "Not available" wording for a fundamentally different state.
  const supplyAprDisplay = resolveSupplyAprDisplay(portfolio);
  const supplyAprSegment =
    supplyAprDisplay.kind === 'available'
      ? ` · Supply APR ${formatPercent(supplyAprDisplay.supplyApr)}`
      : '';
  // "Fees, Slippage & Gas Estimate" — V4 Readiness Audit §12 P1-6. Each
  // of the three is independently configured (or not) on the portfolio's
  // own settings — see `types/portfolio.ts`'s `ExecutionCostAssumptionsSettings`.
  const executionCostAssumptions = portfolio.settings.executionCostAssumptions;
  const swapFeeText =
    executionCostAssumptions?.swapFeeRate !== undefined
      ? formatPercent(executionCostAssumptions.swapFeeRate)
      : 'Not configured';
  const slippageText =
    executionCostAssumptions?.slippageRate !== undefined
      ? formatPercent(executionCostAssumptions.slippageRate)
      : 'Not configured';
  const gasCostText =
    executionCostAssumptions?.gasCostUsd !== undefined
      ? formatCurrency(executionCostAssumptions.gasCostUsd)
      : 'Not configured';

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
          {riskCapacityText} · Borrow APR {borrowAprDisplay}
          {supplyAprSegment}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Borrow Rate</span>
        <span className="text-muted-foreground">{borrowAprDisplay}</span>
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
          Swap fee assumption {swapFeeText} · Slippage assumption {slippageText} · Gas cost
          assumption {gasCostText}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-foreground">Manual-Data Status</span>
        {protocolStatus !== undefined &&
        protocolStatus.version === 'v4' &&
        (protocolStatus.status === 'live' || protocolStatus.status === 'manual') ? (
          // V4 Mixed-Provenance UX batch — a single "Aave V4 · Live"/
          // "Aave V4 · Manual entry" string can never truthfully describe
          // a V4 portfolio whose market/position/collateral-risk
          // dimensions disagree; see `V4ProvenanceDetail`'s own header
          // comment. Every other V4 status keeps the original
          // `resolveManualDataStatusText` string unchanged (see
          // `PortfolioPageClient.tsx`'s identical comment for why).
          <V4ProvenanceDetail breakdown={protocolStatus.breakdown} />
        ) : (
          <span className="text-muted-foreground">
            {resolveManualDataStatusText(
              portfolio.marketSource,
              formatDateTime(portfolio.marketUpdatedAt),
              protocolStatus,
            )}
          </span>
        )}
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
