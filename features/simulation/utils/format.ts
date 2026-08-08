/**
 * Simulation-local formatting helpers — 06_TASKS.md M6-009 ("Implement
 * Scenario Summary"). Same values/behavior as
 * `features/dashboard/utils/format.ts` (Milestone 5) and
 * `app/portfolio/page.tsx`'s own local formatters (Milestone 4) — this
 * project's established convention is each feature owning its own thin
 * formatting layer rather than a shared, premature abstraction (see
 * `features/dashboard/utils/format.ts`'s own header comment for the
 * precedent this file follows).
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

/** `Intl.NumberFormat` renders `Infinity` as "∞" natively — the correct display for a zero-debt Health Factor / Liquidation Distance. */
export function formatHealthFactor(value: number): string {
  return twoDecimalFormatter.format(value);
}

export function formatLeverage(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${twoDecimalFormatter.format(value)}x`;
}

/** Same `Intl.DateTimeFormat` options as `features/dashboard/utils/format.ts`'s own `formatDateTime` — M6-010 ("Implement Scenario Comparison", Batch 9) needs it to label saved scenarios by their real `createdAt` timestamp. */
export function formatDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}
