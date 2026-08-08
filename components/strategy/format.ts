/**
 * Shared Strategy formatting helpers — supports M7-003/M7-004/M7-005.
 * Same values/behavior as `features/simulation/utils/format.ts`
 * (Milestone 6) and `features/dashboard/utils/format.ts` (Milestone 5)
 * — duplicated here rather than imported from either, the same
 * "each location owns its own thin formatting layer" precedent those
 * two files already established for each other. `types/strategy.ts`'s
 * own header comment explains why the *types* this milestone shares are
 * a deliberate exception to that precedent; formatting a number is
 * simple enough that duplicating it stays cheaper than adding a new
 * cross-cutting dependency for it.
 */

/** Module-scoped `Intl` formatter singletons — see `features/dashboard/utils/format.ts`'s own header comment for why (M9-039, "Expensive formatting"). */
const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const twoDecimalFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return currencyFormatter.format(value);
}

export function formatHealthFactor(value: number): string {
  return twoDecimalFormatter.format(value);
}

export function formatLeverage(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${twoDecimalFormatter.format(value)}x`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}
