'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';
import {
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
 * **Table is the primary, accessible source; the chart is a
 * supplementary visual only** — every number the chart plots is already
 * in the table above it, matching `ScenarioCharts.tsx`'s own established
 * "Accessible alternatives... without replacing numerical data"
 * discipline (`role="img"` + a text `aria-label` summarizing the plotted
 * values, `ResponsiveContainer` for layout, `isAnimationActive={false}`
 * per this codebase's own M9-027 motion-stability rule).
 *
 * **Before/after deltas state a change, never a cause** — each row's
 * delta (vs. the next-older entry) is a plain "X → Y" fact, using
 * `comparePortfolioHistoryEntries`'s own deliberately non-causal output;
 * no wording here implies why a value moved.
 */
function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

/** `null` means "zero-debt, Health Factor is Infinity" — rendered as "∞", matching `features/dashboard/utils/format.ts`'s own convention for this same value. */
function formatHealthFactor(value: number | null): string {
  if (value === null) return '∞';
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

function formatDelta(
  delta: PortfolioHistoryMetricDelta,
  format: (value: number) => string,
): string {
  if (!delta.changed) return '—';
  const sign = delta.delta > 0 ? '+' : '';
  return `${format(delta.before)} → ${format(delta.after)} (${sign}${format(delta.delta)})`;
}

function formatNullableDelta(
  delta: PortfolioHistoryNullableMetricDelta,
  format: (value: number) => string,
): string {
  if (!delta.changed) return '—';
  const beforeText = delta.before === null ? '∞' : format(delta.before);
  const afterText = delta.after === null ? '∞' : format(delta.after);
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
      // kept as-is for the table (a changelog reads newest-on-top);
      // the chart below reverses it for a left-to-right chronological line.
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

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatTimestamp(entry.createdAt),
    healthFactor: entry.healthFactor,
  }));
  const chartSummary = `Health Factor trend: ${chartData
    .map((point) => `${point.timestamp} ${formatHealthFactor(point.healthFactor)}`)
    .join(', ')}`;

  return (
    <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-4">
      <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
        History
      </h2>

      {entries.length >= 2 && (
        <div
          role="img"
          aria-label={chartSummary}
          className="h-40 w-full rounded-md border border-border p-2"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="timestamp" hide />
              <YAxis width={32} tick={{ fontSize: 10 }} />
              <Line
                type="monotone"
                dataKey="healthFactor"
                stroke="var(--color-foreground, currentColor)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="overflow-x-auto">
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
              <th scope="col" className="py-1.5 font-medium">
                Borrow APR
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
                    {formatTimestamp(entry.createdAt)}
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
                  <td className="py-1.5">
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
