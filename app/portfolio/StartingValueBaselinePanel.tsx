'use client';

import { useState } from 'react';

import { calculateStartingValueBaselineComparison } from '@/services';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Starting-Value Baseline panel — v1.17.0 Batch 2. Canonical
 * specification: `docs/STARTING_VALUE_BASELINE_SPEC.md` §11.
 *
 * Consumes Batch 1's `calculateStartingValueBaselineComparison` and
 * `usePortfolioStore`'s `setBaseline` action directly — this component
 * performs no financial calculation, no quantity-equality check, and no
 * persistence of its own; it only renders Batch 1's already-computed
 * result and invokes Batch 1's already-validated action.
 *
 * **Terminology (Decision 5, mandatory, no substitutes)**: "Performance
 * since [date]," "Change since baseline," "Baseline value," "Current
 * value." Never "Cost basis," "Acquisition cost," "P&L," "Profit/Loss,"
 * or "Total return" — this feature is a plain price-movement reference
 * point, not an accounting calculation (§1).
 *
 * **Structure mirrors `PortfolioHistoryPanel.tsx`** (this page's nearest
 * sibling in spirit, per §11): an `<h2>`/`aria-labelledby` section, the
 * `<dl>`/`<dt>`/`<dd>` labeled-value pattern `AaveTechnicalDetails.tsx`
 * already established, and a locally-defined thin formatting layer (this
 * codebase's own "each page/feature owns its formatting helpers"
 * convention, restated in `PortfolioHistoryPanel.tsx`'s own header
 * comment) — no new shared formatting abstraction introduced for this
 * one panel.
 */
function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

/** Same "+"-for-positive convention `PortfolioHistoryPanel.tsx`'s own `formatDelta` already uses — `Intl.NumberFormat` renders a negative sign on its own but never a positive one. */
function formatSignedCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatCurrency(value)}`;
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(
    value,
  );
}

/** Same sign convention as `formatSignedCurrency`, for percentage change. */
function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatPercent(value)}`;
}

/** Matches `AaveTechnicalDetails.tsx`'s own `formatDateTime` exactly — no new date/time formatting convention. */
function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function StartingValueBaselinePanel({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const setBaseline = usePortfolioStore((state) => state.setBaseline);
  const [actionError, setActionError] = useState<string | null>(null);

  const comparison = calculateStartingValueBaselineComparison(portfolio);

  function handleSetBaseline() {
    const result = setBaseline(portfolioId);
    setActionError(result.ok ? null : (result.errors[0]?.message ?? 'Could not set baseline.'));
  }

  if (comparison === null) {
    return (
      <section aria-labelledby="starting-value-baseline-heading" className="flex flex-col gap-3">
        <h2 id="starting-value-baseline-heading" className="text-sm font-semibold text-foreground">
          Performance
        </h2>
        <p className="text-xs text-muted-foreground">
          No baseline has been established for this portfolio yet. Set one to track how its value
          changes from this point forward.
        </p>
        <div>
          <button
            type="button"
            onClick={handleSetBaseline}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Set Baseline Now
          </button>
        </div>
        {actionError !== null && (
          <p className="text-xs text-destructive" role="alert">
            {actionError}
          </p>
        )}
      </section>
    );
  }

  const statusId = 'starting-value-baseline-composition-status';
  const changeSinceBaseline = `${formatSignedCurrency(comparison.absoluteChangeUsd)} (${
    comparison.percentageChange === null ? '—' : formatSignedPercent(comparison.percentageChange)
  })`;

  return (
    <section aria-labelledby="starting-value-baseline-heading" className="flex flex-col gap-3">
      <h2 id="starting-value-baseline-heading" className="text-sm font-semibold text-foreground">
        Performance since {formatDateTime(comparison.establishedAt)}
      </h2>

      <dl
        className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs"
        aria-describedby={comparison.status === 'compositionChanged' ? statusId : undefined}
      >
        <dt className="text-muted-foreground">Baseline value</dt>
        <dd className="text-foreground">{formatCurrency(comparison.baselineValueUsd)}</dd>
        <dt className="text-muted-foreground">Current value</dt>
        <dd className="text-foreground">{formatCurrency(comparison.currentValueUsd)}</dd>
        <dt className="text-muted-foreground">Change since baseline</dt>
        <dd className="text-foreground">{changeSinceBaseline}</dd>
      </dl>

      {comparison.status === 'compositionChanged' && (
        <p id={statusId} className="text-xs text-muted-foreground">
          Composition changed since baseline — this comparison no longer reflects price movement
          alone.
        </p>
      )}

      <div>
        <button
          type="button"
          onClick={handleSetBaseline}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent/40"
        >
          Reset Baseline
        </button>
      </div>
      {actionError !== null && (
        <p className="text-xs text-destructive" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
