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
 * **Multi-metric trend chart (V1.3.0 Batch 1, "Portfolio Analytics —
 * Trend Visibility")**: the chart above can now plot Health Factor
 * (unchanged default), Net Worth, Loan-to-Value, or Leverage, switched
 * via a compact `<select>` rather than stacking four permanent charts —
 * see `PORTFOLIO_HISTORY_METRICS` below. The table/card views, their
 * values, and every existing accessibility/motion behavior are
 * unchanged; only the supplementary chart gained a selector. Net Worth
 * is `docs/02_Formulas.md`'s own already-specified "Portfolio Value −
 * Debt" equation applied to a stored snapshot's own `collateral.valueUsd`/
 * `debt.valueUsd` — no new formula. LTV/Leverage read the already-
 * persisted `loanToValue`/`leverage` fields directly, never recomputed.
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
 * V1.3.0 Batch 1 ("Portfolio Analytics — Trend Visibility"). Lets the
 * trend chart below plot one of four metrics without permanently
 * stacking four charts — a compact selector switches which of these
 * `getValue`/`formatValue` pairs feeds the same single `LineChart`.
 *
 * **Net Worth is exactly `docs/02_Formulas.md`'s own "Net Worth =
 * Portfolio Value − Debt" equation** (Assets minus Debt), applied to one
 * already-persisted snapshot's own `collateral.valueUsd`/`debt.valueUsd`
 * — no new formula, no Engine involvement, not an alternative
 * definition. Loan-to-Value and Leverage read the already-persisted
 * `loanToValue`/`leverage` fields directly, the same values the table
 * above already renders — never recomputed here.
 */
type PortfolioHistoryMetricKey = 'healthFactor' | 'netWorth' | 'loanToValue' | 'leverage';

interface PortfolioHistoryMetricConfig {
  label: string;
  getValue: (entry: PersistedPortfolioHistoryEntry) => number | null;
  formatValue: (value: number | null) => string;
}

const PORTFOLIO_HISTORY_METRICS: Record<PortfolioHistoryMetricKey, PortfolioHistoryMetricConfig> = {
  healthFactor: {
    label: 'Health Factor',
    getValue: (entry) => entry.healthFactor,
    formatValue: (value) => formatHealthFactor(value),
  },
  netWorth: {
    label: 'Net Worth',
    getValue: (entry) => entry.collateral.valueUsd - entry.debt.valueUsd,
    formatValue: (value) => (value === null ? '—' : formatCurrency(value)),
  },
  loanToValue: {
    label: 'Loan-to-Value',
    getValue: (entry) => entry.loanToValue,
    formatValue: (value) => (value === null ? '—' : formatPercent(value)),
  },
  leverage: {
    label: 'Leverage',
    getValue: (entry) => entry.leverage,
    formatValue: (value) => (value === null ? '—' : `${formatHealthFactor(value)}x`),
  },
};

/** Selector order, matching the order the task's own required list names them. */
const PORTFOLIO_HISTORY_METRIC_ORDER: PortfolioHistoryMetricKey[] = [
  'healthFactor',
  'netWorth',
  'loanToValue',
  'leverage',
];

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

function HistoryEntryCard({
  entry,
  delta,
}: {
  entry: PersistedPortfolioHistoryEntry;
  delta: ReturnType<typeof comparePortfolioHistoryEntries> | null;
}) {
  return (
    <li className="flex flex-col gap-2 rounded-md border border-border p-3 text-xs">
      <p className="font-medium text-foreground">{formatTimestamp(entry.createdAt)}</p>
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
          ] as const
        ).map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted-foreground">{row.label}</dt>
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
  const [selectedMetric, setSelectedMetric] = useState<PortfolioHistoryMetricKey>('healthFactor');

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

  const selectedMetricConfig = PORTFOLIO_HISTORY_METRICS[selectedMetric];
  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatTimestamp(entry.createdAt),
    value: selectedMetricConfig.getValue(entry),
  }));
  const chartSummary = `${selectedMetricConfig.label} trend: ${chartData
    .map((point) => `${point.timestamp} ${selectedMetricConfig.formatValue(point.value)}`)
    .join(', ')}`;

  return (
    <section aria-labelledby="portfolio-history-heading" className="flex flex-col gap-4">
      <h2 id="portfolio-history-heading" className="text-sm font-semibold text-foreground">
        History
      </h2>

      {entries.length >= 2 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-end gap-2">
            <label
              htmlFor="portfolio-history-metric-select"
              className="text-xs text-muted-foreground"
            >
              Chart metric
            </label>
            <select
              id="portfolio-history-metric-select"
              value={selectedMetric}
              onChange={(event) =>
                setSelectedMetric(event.target.value as PortfolioHistoryMetricKey)
              }
              className="rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground"
            >
              {PORTFOLIO_HISTORY_METRIC_ORDER.map((key) => (
                <option key={key} value={key}>
                  {PORTFOLIO_HISTORY_METRICS[key].label}
                </option>
              ))}
            </select>
          </div>
          <div
            role="img"
            aria-label={chartSummary}
            className="h-40 w-full rounded-md border border-border p-2"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="timestamp" hide />
                <YAxis
                  width={selectedMetric === 'netWorth' ? 56 : 32}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value: number) => selectedMetricConfig.formatValue(value)}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-foreground, currentColor)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
