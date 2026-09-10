import type { SafetyTargetStatus } from '@/services';

/**
 * Safety Targets Status Summary types — v1.23.0 Batch 2 (Dashboard
 * Safety Targets Status Integration). Thin, Dashboard-owned display
 * shape around `buildSafetyTargetsStatus`'s own already-complete
 * `SafetyTargetsStatus` result (`services/portfolio/safetyTargetsStatus.ts`,
 * v1.23.0 Batch 1) — the same "builder formats, component only renders
 * strings" division of labor `StartingValueBaselineSummary`
 * (`./startingValueBaselineSummary.ts`) already establishes for the same
 * kind of Portfolio-page-to-Dashboard reuse. No comparison logic here or
 * in `../utils/buildSafetyTargetsStatusSummary.ts` — see that file's own
 * header comment. `status` on each row is a direct copy of the
 * canonical `SafetyTargetComparison.status` discriminant, never
 * re-derived from the formatted strings.
 *
 * **Always four rows, in the same fixed order as the Portfolio page's
 * own panel** (`app/portfolio/SafetyTargetsStatusPanel.tsx`) — Target
 * Health Factor, Holding Period, Target BTC Price, Safety Buffer %.
 * Unlike Starting-Value Baseline (a single set-or-not concept with one
 * `hasBaseline` gate), each Safety Target is independently optional
 * (v1.23.0 Batch 1's own "treat each field independently" rule) — there
 * is no single collapsed "not configured" state for the whole summary;
 * a row with no target configured simply reads "Not configured" on its
 * own.
 */
export interface SafetyTargetRowSummary {
  key: 'targetHealthFactor' | 'targetBtcPriceUsd' | 'safetyBufferPercent' | 'holdingPeriodDays';
  label: string;
  /** Direct copy of `SafetyTargetComparison.status` — never re-derived. */
  status: SafetyTargetStatus;
  /** e.g. "Target: 1.50 · Current: 2.10". */
  detailFormatted: string;
  /** "Met" / "Not met" / "Not configured" / "Not available" / (Safety Buffer % zero-debt only) "No liquidation risk to compare against". */
  statusLabel: string;
}

export interface SafetyTargetsStatusSummary {
  rows: SafetyTargetRowSummary[];
}
