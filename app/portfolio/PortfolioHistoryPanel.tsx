'use client';

import { useEffect, useState } from 'react';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';
import {
  calculateLiquidationBufferPercent,
  comparePortfolioHistoryEntries,
  type PortfolioHistoryMetricDelta,
  type PortfolioHistoryNullableMetricDelta,
  type PortfolioHistoryOptionalMetricDelta,
} from '@/services/portfolioHistory';

/**
 * Portfolio History panel — V1.1 Batch 2 ("Portfolio History & Risk
 * Timeline"). Reads persisted `'portfolioHistory'` entries directly via
 * `listPortfolioHistoryForPortfolio` (local component state + effect,
 * the same pattern `SettingsPageClient`'s own Recovery Snapshots section
 * already uses for a persisted list — not Zustand Store state, since
 * this data is never edited in place, only appended to and read).
 * Re-fetches on `portfolio.updatedAt` change, the same dependency
 * `PortfolioPageClient`'s own effects already key on to notice "this
 * portfolio's own record was written again."
 *
 * **Before/after deltas state a change, never a cause** — each row's
 * delta (vs. the next-older entry) is a plain "X → Y" fact, using
 * `comparePortfolioHistoryEntries`'s own deliberately non-causal output;
 * no wording here implies why a value moved.
 *
 * **Responsive card view below `sm:` (V1.1 Batch 7, Section 4)**: the
 * task's own explicit guidance for this panel — "do not force a wide
 * desktop table into 320px; use responsive cards... preserve timestamp +
 * HF + collateral + debt + meaningful change visibility." The 7-column
 * table already sat in an `overflow-x-auto` wrapper (a real, pre-existing
 * mitigation, not new this batch), but each cell's own delta sub-line
 * (e.g. "$123,456.78 → $130,000.00 (+$6,543.22)") is long enough that
 * scrolling to see later columns is still a real cost at 320–375px — a
 * one-card-per-entry list avoids that scroll entirely by giving every
 * value its own full-width row. Both views render from the same
 * `entries`/`comparePortfolioHistoryEntries` data and the same
 * `format*`/`formatDelta*` helpers below — no separate data path, only a
 * separate layout, one hidden via `sm:hidden` and the other via `hidden
 * sm:block`.
 *
 * **V1.12.0 Batch 4 ("Portfolio History Data-Source Provenance")** adds a
 * small "Manual"/"Live" badge next to each row's own timestamp, in both
 * the table's "When" cell and the mobile card's header — the same
 * `entry.dataSource: 'manual' | 'live'` field already persisted on every
 * entry (`services/persistence/types/models.ts`'s own header comment:
 * "was any of the data behind this snapshot live-sourced at the time" —
 * a summarizing flag, not a reconstruction of a live portfolio's own
 * four separate provenance fields). Read directly, never inferred from
 * `protocolVersion` or from any current/live state, and never
 * recomputed — the same "display the persisted snapshot exactly"
 * discipline every other field on this page already follows. Reuses the
 * exact `"rounded-full bg-muted px-2 py-0.5"` badge className and
 * `'live'` → `'Live'` / `'manual'` → `'Manual'` label convention already
 * established elsewhere in this app (`utils/protocolStatus.ts`'s own
 * `formatV4ProvenanceStatus`, `app/portfolios/PortfoliosPageClient.tsx`'s
 * own status chips) — no new visual language introduced. Not added as a
 * new chart-selector metric or its own table column: it is categorical,
 * not a numeric trend, and pairing it with the timestamp that already
 * anchors each row avoids widening the already-11-column table or adding
 * a card row, per this batch's own "should not visually dominate"
 * requirement.
 *
 * **V1.13.0 Batch 1 ("Protocol-Version Provenance Badge")** adds a second
 * small badge next to the data-source one above, showing each entry's
 * own persisted `entry.protocolVersion: 'v3' | 'v4'`
 * (`services/persistence/types/models.ts`) — "Aave V3"/"Aave V4", the
 * exact wording already used for user-facing protocol-version
 * identification elsewhere (`AaveProtocolVersionForm.tsx`,
 * `NewPortfolioPageClient.tsx`). A portfolio can switch protocol
 * versions on an existing record (`AaveProtocolVersionForm.tsx`), so its
 * own history can genuinely span both — this badge is what makes each
 * older snapshot's protocol version legible again, rather than only the
 * portfolio's *current* setting. Read directly from the snapshot, the
 * same discipline the data-source badge already established: never
 * inferred from the portfolio's current `protocolVersion`, never
 * recomputed, and both versions treated identically (this file still
 * never branches its own logic on `entry.protocolVersion` — the badge
 * only displays the value, it does not change how any other cell is
 * computed). Reuses the exact same
 * `"rounded-full bg-muted px-2 py-0.5 text-xs font-normal
 * text-muted-foreground"` badge className as the data-source badge,
 * placed immediately before it — categorical, not a chart metric or
 * table column, for the same reason the data-source badge isn't one.
 *
 * **Trends removal (Dashboard/Portfolio History Trends Removal batch).**
 * This panel previously rendered a supplementary trend chart above the
 * table/card views — a 14-metric `<select>`-driven `recharts` `LineChart`
 * plotting one already-persisted or already-derived field per snapshot.
 * Removed outright, not redesigned: a read-only UX audit found every
 * chart metric duplicated a value already visible in the table/cards
 * below it, with no time axis, tooltip, or current-value emphasis of its
 * own, and the underlying Portfolio History data model — snapshots
 * recorded only on deliberate, materially-different changes — structurally
 * cannot accumulate enough points for a real trend most of the time. The
 * table/card views, before/after deltas, protocol/data-source badges, and
 * every other non-chart behavior documented above are unchanged.
 */
function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

/** `null` means "zero-debt, Health Factor is Infinity" — rendered as "∞", matching `features/dashboard/utils/format.ts`'s own convention for this same value. Also used for `entry.leverage` (V1.1 Batch 4), which is a plain finite `number` per the persisted schema; the `NaN` guard is defensive only. */
function formatHealthFactor(value: number | null): string {
  if (value === null) return '∞';
  if (Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(
    value,
  );
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/**
 * `entry.dataSource` is always exactly `'manual'` or `'live'` — the
 * persisted contract's own two allowed values
 * (`services/persistence/types/models.ts`), never a third state to
 * guess at. Same short-label convention every other manual/live
 * indicator in this app already uses (`utils/protocolStatus.ts`'s own
 * `formatV4ProvenanceStatus`) — not a new wording invented for this
 * batch.
 */
function formatDataSource(value: 'manual' | 'live'): string {
  return value === 'live' ? 'Live' : 'Manual';
}

/**
 * `entry.protocolVersion` is always exactly `'v3'` or `'v4'` — the
 * persisted contract's own two allowed values
 * (`services/persistence/types/models.ts`), never a third state to
 * guess at. "Aave V3"/"Aave V4" matches the exact wording this app
 * already uses for user-facing protocol-version identification
 * elsewhere (`app/portfolio/AaveProtocolVersionForm.tsx`'s own "Aave
 * V3"/"Aave V4" radio labels, `app/portfolios/new/NewPortfolioPageClient.tsx`'s
 * matching labels) — no new wording invented for this batch.
 */
function formatProtocolVersion(value: 'v3' | 'v4'): string {
  return value === 'v4' ? 'Aave V4' : 'Aave V3';
}

/**
 * `null` means "zero-debt, no liquidation risk" — matching the exact
 * established app-wide convention this same nullable field already uses
 * elsewhere (`features/portfolioApply/components/ApplyToPortfolioReview.tsx`,
 * `features/recommendations/components/RecommendationDetailPanel.tsx`: "No
 * liquidation risk"), **not** the Health-Factor-specific "∞" glyph — a null
 * liquidation price is not "an infinite price," it is the absence of
 * liquidation risk, a distinct concept this formatter states directly
 * rather than borrowing an unrelated convention.
 */
function formatLiquidationPrice(value: number | null): string {
  if (value === null) return 'No liquidation risk';
  return formatCurrency(value);
}

/**
 * `null` means "no liquidation risk" (zero-debt, or an otherwise
 * unavailable denominator — see `calculateLiquidationBufferPercent`'s own
 * comment) — same "No liquidation risk" text as `formatLiquidationPrice`,
 * never a fabricated `0%`. A negative value (market at or below the
 * liquidation price) is rendered as-is, not clamped.
 */
function formatLiquidationBufferPercent(value: number | null): string {
  if (value === null) return 'No liquidation risk';
  return formatPercent(value);
}

/**
 * Concise, user-facing disambiguation for `title` attributes on the
 * "Interest Cost (annualized)" table header and card label — per this
 * batch's own explicit semantic requirement: this figure must never be
 * read as interest already paid, cumulative interest, realized
 * borrowing cost, or interest paid since inception.
 */
const ANNUALIZED_INTEREST_COST_TOOLTIP =
  "Projected annualized borrowing cost at this snapshot's own debt and rate — not interest already paid or a running total.";

/**
 * Concise, user-facing disambiguation for the "Liquidation Buffer" table
 * header and card label — per this batch's own explicit requirement that
 * the label make clear this is a percentage distance between this
 * snapshot's own market price and estimated liquidation price, not a
 * Health Factor risk classification.
 */
const LIQUIDATION_BUFFER_TOOLTIP =
  "Percentage distance between this snapshot's own market price and estimated liquidation price — not a Health Factor risk classification.";

function formatDelta(
  delta: PortfolioHistoryMetricDelta,
  format: (value: number) => string,
): string {
  if (!delta.changed) return '—';
  const sign = delta.delta > 0 ? '+' : '';
  return `${format(delta.before)} → ${format(delta.after)} (${sign}${format(delta.delta)})`;
}

/**
 * `nullLabel` defaults to '∞' — Health Factor's own existing, unchanged
 * convention — so every pre-V1.5.0 call site keeps its exact prior
 * behavior. Liquidation Price passes `'No liquidation risk'` instead
 * (see `formatLiquidationPrice`'s own comment for why "∞" would be
 * wrong there).
 */
function formatNullableDelta(
  delta: PortfolioHistoryNullableMetricDelta,
  format: (value: number) => string,
  nullLabel: string = '∞',
): string {
  if (!delta.changed) return '—';
  const beforeText = delta.before === null ? nullLabel : format(delta.before);
  const afterText = delta.after === null ? nullLabel : format(delta.after);
  if (delta.before === null || delta.after === null) {
    return `${beforeText} → ${afterText}`;
  }
  const sign = (delta.delta ?? 0) > 0 ? '+' : '';
  return `${beforeText} → ${afterText} (${sign}${format(delta.delta ?? 0)})`;
}

function formatOptionalDelta(
  delta: PortfolioHistoryOptionalMetricDelta,
  format: (value: number) => string,
): string {
  if (!delta.changed) return '—';
  if (delta.before === undefined || delta.after === undefined) {
    // Availability itself changed (e.g. now derivable, previously wasn't)
    // — a fact worth stating plainly, not a numeric delta to compute.
    return `${delta.before !== undefined ? format(delta.before) : 'Not available'} → ${
      delta.after !== undefined ? format(delta.after) : 'Not available'
    }`;
  }
  const sign = (delta.delta ?? 0) > 0 ? '+' : '';
  return `${format(delta.before)} → ${format(delta.after)} (${sign}${format(delta.delta ?? 0)})`;
}

function HistoryEntryCard({
  entry,
  delta,
}: {
  entry: PersistedPortfolioHistoryEntry;
  delta: ReturnType<typeof comparePortfolioHistoryEntries> | null;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-3 text-xs">
      <p className="flex items-center gap-2 font-medium text-foreground">
        <span>{formatTimestamp(entry.createdAt)}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {formatProtocolVersion(entry.protocolVersion)}
        </span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
          {formatDataSource(entry.dataSource)}
        </span>
      </p>
      <dl className="flex flex-col gap-1.5">
        {(
          [
            {
              label: 'Health Factor',
              value: formatHealthFactor(entry.healthFactor),
              delta:
                delta !== null ? formatNullableDelta(delta.healthFactor, formatHealthFactor) : null,
            },
            {
              label: 'Collateral Value',
              value: formatCurrency(entry.collateral.valueUsd),
              delta: delta !== null ? formatDelta(delta.collateralValueUsd, formatCurrency) : null,
            },
            {
              label: 'Debt Value',
              value: formatCurrency(entry.debt.valueUsd),
              delta: delta !== null ? formatDelta(delta.debtValueUsd, formatCurrency) : null,
            },
            {
              label: 'LTV',
              value: formatPercent(entry.loanToValue),
              delta: delta !== null ? formatDelta(delta.loanToValue, formatPercent) : null,
            },
            {
              label: 'Leverage',
              value: `${formatHealthFactor(entry.leverage)}x`,
              delta:
                delta !== null
                  ? formatDelta(delta.leverage, (v) => `${formatHealthFactor(v)}x`)
                  : null,
            },
            {
              label: 'Borrow APR',
              value:
                entry.borrowApr !== undefined ? formatPercent(entry.borrowApr) : 'Not available',
              delta: delta !== null ? formatOptionalDelta(delta.borrowApr, formatPercent) : null,
            },
            {
              label: 'Interest Cost (annualized)',
              value: formatCurrency(entry.annualizedInterestCost),
              delta:
                delta !== null ? formatDelta(delta.annualizedInterestCost, formatCurrency) : null,
            },
            {
              label: 'Market Price',
              value: formatCurrency(entry.marketPriceUsd),
              delta: delta !== null ? formatDelta(delta.marketPriceUsd, formatCurrency) : null,
            },
            {
              label: 'Liquidation Price',
              value: formatLiquidationPrice(entry.liquidationPriceUsd),
              delta:
                delta !== null
                  ? formatNullableDelta(
                      delta.liquidationPriceUsd,
                      formatCurrency,
                      'No liquidation risk',
                    )
                  : null,
            },
            {
              label: 'Liquidation Buffer',
              value: formatLiquidationBufferPercent(
                calculateLiquidationBufferPercent(entry.marketPriceUsd, entry.liquidationPriceUsd),
              ),
              delta:
                delta !== null
                  ? formatNullableDelta(
                      delta.liquidationBufferPercent,
                      formatPercent,
                      'No liquidation risk',
                    )
                  : null,
            },
          ] as const
        ).map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt
                className="text-muted-foreground"
                title={
                  row.label === 'Interest Cost (annualized)'
                    ? ANNUALIZED_INTEREST_COST_TOOLTIP
                    : row.label === 'Liquidation Buffer'
                      ? LIQUIDATION_BUFFER_TOOLTIP
                      : undefined
                }
              >
                {row.label}
              </dt>
              <dd className="text-right text-foreground">{row.value}</dd>
            </div>
            {row.delta !== null && row.delta !== '—' && (
              <p className="text-right text-muted-foreground">{row.delta}</p>
            )}
          </div>
        ))}
      </dl>
    </li>
  );
}

export function PortfolioHistoryPanel({
  portfolioId,
  portfolioUpdatedAt,
}: {
  portfolioId: string;
  portfolioUpdatedAt: string;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [entries, setEntries] = useState<PersistedPortfolioHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    void listPortfolioHistoryForPortfolio(portfolioId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setStatus('error');
        return;
      }
      // `listPortfolioHistoryForPortfolio` returns most-recent-first —
      // a changelog reads newest-on-top.
      setEntries(result.data.map((envelope) => envelope.payload));
      setStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [portfolioId, portfolioUpdatedAt]);

  if (status === 'loading') {
    return (
      <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-3">
        <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
          History
        </h2>
        {/* No `role="status"` here — `PortfolioPageClient`'s own save-status
            region already owns that role on this page (M4-013); a second
            `role="status"` element would make any `getByRole('status')`
            query on the page ambiguous. This loading state is brief and
            panel-local, not the page's primary live-region announcement. */}
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </section>
    );
  }

  if (status === 'error') {
    return (
      <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-3">
        <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
          History
        </h2>
        <p className="text-xs text-destructive" role="alert">
          History could not be loaded.
        </p>
      </section>
    );
  }

  if (entries.length === 0) {
    return (
      <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-3">
        <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
          History
        </h2>
        <p className="text-xs text-muted-foreground">
          No history yet. A snapshot is recorded automatically when you create or update this
          portfolio, or accept live Aave data that differs meaningfully from what you last saved.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-4">
      <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
        History
      </h2>

      <ul className="flex flex-col gap-3 sm:hidden">
        {entries.map((entry, index) => {
          const olderEntry = entries[index + 1];
          const delta =
            olderEntry !== undefined ? comparePortfolioHistoryEntries(olderEntry, entry) : null;
          return (
            <HistoryEntryCard key={`${entry.createdAt}-${index}`} entry={entry} delta={delta} />
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                When
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Health Factor
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Collateral Value
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Debt Value
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                LTV
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Leverage
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Borrow APR
              </th>
              <th
                scope="col"
                className="py-1.5 pr-3 font-medium"
                title={ANNUALIZED_INTEREST_COST_TOOLTIP}
              >
                Interest Cost (annualized)
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Market Price
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Liquidation Price
              </th>
              <th scope="col" className="py-1.5 font-medium" title={LIQUIDATION_BUFFER_TOOLTIP}>
                Liquidation Buffer
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => {
              const olderEntry = entries[index + 1];
              const delta =
                olderEntry !== undefined ? comparePortfolioHistoryEntries(olderEntry, entry) : null;
              return (
                <tr key={`${entry.createdAt}-${index}`} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 text-foreground">
                    <div className="flex items-center gap-2">
                      <span>{formatTimestamp(entry.createdAt)}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {formatProtocolVersion(entry.protocolVersion)}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                        {formatDataSource(entry.dataSource)}
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{formatHealthFactor(entry.healthFactor)}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatNullableDelta(delta.healthFactor, formatHealthFactor)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">
                      {formatCurrency(entry.collateral.valueUsd)}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.collateralValueUsd, formatCurrency)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{formatCurrency(entry.debt.valueUsd)}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.debtValueUsd, formatCurrency)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{formatPercent(entry.loanToValue)}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.loanToValue, formatPercent)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{`${formatHealthFactor(entry.leverage)}x`}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.leverage, (v) => `${formatHealthFactor(v)}x`)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">
                      {entry.borrowApr !== undefined
                        ? formatPercent(entry.borrowApr)
                        : 'Not available'}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatOptionalDelta(delta.borrowApr, formatPercent)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">
                      {formatCurrency(entry.annualizedInterestCost)}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.annualizedInterestCost, formatCurrency)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">{formatCurrency(entry.marketPriceUsd)}</div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatDelta(delta.marketPriceUsd, formatCurrency)}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="text-foreground">
                      {formatLiquidationPrice(entry.liquidationPriceUsd)}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatNullableDelta(
                          delta.liquidationPriceUsd,
                          formatCurrency,
                          'No liquidation risk',
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5">
                    <div className="text-foreground">
                      {formatLiquidationBufferPercent(
                        calculateLiquidationBufferPercent(
                          entry.marketPriceUsd,
                          entry.liquidationPriceUsd,
                        ),
                      )}
                    </div>
                    {delta !== null && (
                      <div className="text-muted-foreground">
                        {formatNullableDelta(
                          delta.liquidationBufferPercent,
                          formatPercent,
                          'No liquidation risk',
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
