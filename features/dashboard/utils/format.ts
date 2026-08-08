/**
 * Dashboard-local formatting helpers — part of M5-003's "Formatted
 * values" Include item.
 *
 * Deliberately not extracted to a shared `utils/format.ts` used by other
 * pages: `app/portfolio/page.tsx` already defines its own identical
 * `formatCurrency`/`formatHealthFactor`/`formatPercent`/`formatDateTime`
 * locally (Milestone 4), and this project's established convention is
 * each page/feature owning its own thin formatting layer rather than a
 * premature shared abstraction — see that file for the precedent. Values
 * and behavior are kept identical on purpose (same `Intl` options, same
 * Conflict #6 interpretation: Health Factor at 2 decimals) so a number
 * reads the same on the Dashboard as it does on the Portfolio page.
 */
import type { PortfolioSaveStatus } from '@/stores/portfolioStore';

/**
 * Module-scoped `Intl` formatter singletons (M9-039, "Optimize Rendering
 * Behavior" — "Expensive formatting") — `Intl.NumberFormat`/
 * `Intl.DateTimeFormat` construction is measurably non-trivial (locale/
 * option resolution), and these formatters are called per-cell inside
 * list renders (e.g. KPI grids, scenario tables); constructing one per
 * call inside a loop repeats that cost N times for no behavioral benefit
 * over one shared instance, since none of the calls below vary their
 * options.
 */
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const twoDecimalFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 2,
});
const quantityFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return currencyFormatter.format(value);
}

/** `Intl.NumberFormat` renders `Infinity` as "∞" natively — the correct display for a zero-debt portfolio's Health Factor (M2-009) and its F-023 Distance to Liquidation (`healthFactor - 1.0`, also `Infinity` at zero debt). */
export function formatHealthFactor(value: number): string {
  return twoDecimalFormatter.format(value);
}

/** Plain 2-decimal number — used for F-023 Distance to Liquidation, a raw `healthFactor - 1.0` ratio per `docs/02_Formulas.md`, not a 0–1 fraction. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return formatHealthFactor(value);
  return twoDecimalFormatter.format(value);
}

/** For a genuine 0–1 fraction (e.g. F-020 LTV). */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return percentFormatter.format(value);
}

/** For a value `docs/02_Formulas.md` already scales to 0–100 (F-025 Liquidation Buffer's own "× 100" step) — dividing by 100 first, unlike `formatPercent`, which expects an unscaled 0–1 fraction. */
export function formatPercentagePoints(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return percentFormatter.format(value / 100);
}

export function formatLeverage(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${twoDecimalFormatter.format(value)}x`;
}

/** Asset quantity (e.g. BTC holdings) — up to 8 fraction digits, matching BTC's own on-chain precision; trailing zeros are not forced. */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return quantityFormatter.format(value);
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}

/**
 * M5-004's "Storage status" Display item — same wording
 * `app/portfolio/page.tsx`'s own `formatSaveStatus` uses (M4-013:
 * Conflict B, an in-memory Store, not a durable save), added here rather
 * than imported since that function is not exported from its page file
 * (this project's established per-page/per-feature convention — see this
 * file's own header comment).
 */
export function formatSaveStatus(status: PortfolioSaveStatus): string {
  switch (status) {
    case 'idle':
      return 'No changes yet';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'error':
      return 'Error saving';
    case 'offline':
      return 'Offline';
  }
}
