/**
 * Liquidation Buffer % — v1.6.0 Batch 1 ("Liquidation Buffer Visibility").
 * A DISPLAY/SERVICE-LAYER DERIVED value only: percentage distance between
 * an already-persisted `marketPriceUsd` and an already-persisted
 * `liquidationPriceUsd` on one `PersistedPortfolioHistoryEntry`. Not a new
 * Engine formula, not a new Formula ID, not a protocol parameter, and not
 * a Health Factor risk classification — it consumes two existing values
 * exactly as stored and performs no protocol- or version-specific
 * branching, matching how `comparePortfolioHistoryEntries.ts`'s own
 * deltas are already un-Formula-ID'd service-layer arithmetic.
 *
 * Buffer = (marketPriceUsd − liquidationPriceUsd) / marketPriceUsd
 *
 * Returned as a plain fraction (e.g. `0.4235`, not `42.35`) — the same
 * convention `entry.loanToValue` already uses — so callers format it with
 * the existing percent formatter rather than a bespoke one.
 *
 * - Positive: market price is above the liquidation price (normal case).
 * - Zero: market price equals the liquidation price.
 * - Negative: market price is at or below the liquidation price — not
 *   clamped, since clamping would hide how far past liquidation the
 *   snapshot already was.
 * - `liquidationPriceUsd === null` (zero-debt, no liquidation risk) =>
 *   `null`. Never fabricated as `0%` — a zero-debt entry has no
 *   liquidation risk to measure a buffer against, which is a different
 *   fact than "buffer is exactly zero."
 * - An invalid or non-positive `marketPriceUsd` denominator (`<= 0`,
 *   `NaN`, non-finite) also yields `null` rather than `NaN`/`Infinity` —
 *   this should not occur for a real persisted snapshot, but the
 *   computation stays safe rather than propagating a non-finite value
 *   into formatting/charting.
 */
export function calculateLiquidationBufferPercent(
  marketPriceUsd: number,
  liquidationPriceUsd: number | null,
): number | null {
  if (liquidationPriceUsd === null) return null;
  if (!Number.isFinite(marketPriceUsd) || marketPriceUsd <= 0) return null;
  if (!Number.isFinite(liquidationPriceUsd)) return null;
  return (marketPriceUsd - liquidationPriceUsd) / marketPriceUsd;
}
