import { formatV4ProvenanceStatus, type V4ProvenanceBreakdown } from '@/utils/protocolStatus';

/**
 * Truthful, field/semantic-group-level V4 provenance display — V4
 * Mixed-Provenance UX batch. Replaces every "Aave V4 · Live"/"Aave V4 ·
 * Manual entry" single-string composite badge, which silently collapsed
 * mixed provenance (e.g. a live BTC price and live base drawn APR next
 * to a manually-entered debt position) into one misleading whole-portfolio
 * classification. See `deriveV4ProvenanceBreakdown`'s own header comment
 * (`utils/protocolStatus.ts`) for exactly what each of the four rows
 * means and why no finer precision than this is claimed.
 *
 * **Pure view, no Store reads** — same discipline
 * `components/strategy/StrategyAssumptionsPanel.tsx` already establishes
 * for this exact reason: the caller supplies an already-computed
 * `V4ProvenanceBreakdown` (via `deriveProtocolStatus`'s own `.breakdown`
 * field, computed once per page from data that page already reads), this
 * component only renders it.
 *
 * **One shared component, every V4 status-badge mount point** — the same
 * "one shared component, N mount points" precedent
 * `AaveV4LiveErrorNotice.tsx` already establishes for the adjacent V4
 * live-error concern: Portfolio (Collateral and Debt sections),
 * Dashboard, and (via `StrategyAssumptionsPanel`/`SimulationAssumptions`)
 * Simulation, Loop Builder, Exit Planner, Recommendations.
 *
 * **Deliberately compact** — a single wrapped line of four short badges,
 * not a multi-row block, so replacing the old one-line composite string
 * does not add vertical clutter to any of its seven mount points.
 */
export function V4ProvenanceDetail({ breakdown }: { breakdown: V4ProvenanceBreakdown }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="rounded-full bg-muted px-2 py-0.5">
        BTC price {formatV4ProvenanceStatus(breakdown.market.btcPrice)}
      </span>
      <span className="rounded-full bg-muted px-2 py-0.5">
        Base drawn APR {formatV4ProvenanceStatus(breakdown.market.baseDrawnApr)}
      </span>
      <span className="rounded-full bg-muted px-2 py-0.5">
        Debt position {formatV4ProvenanceStatus(breakdown.position)}
      </span>
      <span className="rounded-full bg-muted px-2 py-0.5">
        Collateral risk {formatV4ProvenanceStatus(breakdown.collateralRisk)}
      </span>
    </span>
  );
}
