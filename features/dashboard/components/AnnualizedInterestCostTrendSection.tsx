'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';

import { formatCurrency, formatDateTime } from '../utils/format';

/**
 * Annualized Interest Cost Trend Section — v1.9.0 Batch 1 ("Dashboard
 * Annualized Interest Cost Trend"). A compact, read-only historical view
 * of the same "Interest Cost (annualized)" metric
 * `app/portfolio/PortfolioHistoryPanel.tsx` already charts — this
 * component reads through the identical `listPortfolioHistoryForPortfolio`
 * service call (local component state + effect, not a new persistence
 * path or Zustand store), the same architecture `HealthFactorTrendSection.tsx`
 * (v1.7.0 Batch 1) and `LiquidationBufferTrendSection.tsx` (v1.8.0
 * Batch 1) already established, so the Dashboard's trend-chart set now
 * covers Health Factor, Liquidation Buffer, and Interest Cost.
 *
 * **Presentation/read-layer only — a direct field read, not a derived
 * helper.** Every plotted value is `entry.annualizedInterestCost` itself:
 * unlike Liquidation Buffer (which recomputes a percentage from two raw
 * fields via a dedicated `services/portfolioHistory/` helper), this
 * field is already the exact number `PortfolioHistoryPanel.tsx`'s own
 * table and card view render — there is no derived-helper layer here to
 * distinguish from an Engine formula, and this component introduces
 * none: no new Engine formula, no new Formula ID, no new persisted
 * field.
 *
 * **A point-in-time projection, never a running total.** Per
 * `PortfolioHistoryPanel.tsx`'s own established framing:
 * `entry.annualizedInterestCost` is the projected annual borrowing cost
 * implied by *that one snapshot's own* debt balance and rate — never
 * interest already paid, cumulative interest, realized borrowing cost,
 * or interest paid since inception. Plotting it across snapshots shows
 * how that projection moved over time (e.g. a rate change even with debt
 * held constant); it does not, and must never be read to, sum to a total
 * amount actually paid. This chart's own aria-label summary and empty/
 * single-entry copy preserve that framing explicitly rather than using
 * generic "cost" language that could be misread as cumulative.
 *
 * **Always a plain, required number — no null handling, no
 * protocol-version branching.** Unlike Health Factor and Liquidation
 * Buffer (both nullable for a zero-debt portfolio),
 * `annualizedInterestCost` is a required `number` for every persisted
 * entry regardless of protocol version (always populated from
 * `summary.interestCost` at record time — see
 * `services/portfolioHistory/buildPortfolioHistoryEntry.ts`), so this
 * component has no "no risk"/"not available" branch to render and never
 * reads `entry.protocolVersion`.
 *
 * **No risk-band classification, no color thresholds.** Same discipline
 * `HealthFactorTrendSection.tsx` and `LiquidationBufferTrendSection.tsx`
 * already follow — this shows the raw value and its trend only.
 *
 * **Fewer than two entries never renders a chart** — mirrors both
 * sibling trend sections' own "no chart below two entries" rule exactly.
 * A single entry's own value is still shown as plain text, so the
 * component never silently shows nothing when real data exists — but no
 * second point is ever fabricated to make a line renderable.
 */
function annualizedInterestCostForEntry(entry: PersistedPortfolioHistoryEntry): number {
  return entry.annualizedInterestCost;
}

export function AnnualizedInterestCostTrendSection({
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
      // Most-recent-first from the service — reversed below for a
      // left-to-right chronological line, the same convention the
      // sibling trend sections' own charts already use.
      setEntries(result.data.map((envelope) => envelope.payload));
      setStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [portfolioId, portfolioUpdatedAt]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Interest Cost (annualized) Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Interest Cost (annualized) Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Interest Cost (annualized) Trend</h3>
        <p className="text-xs text-muted-foreground">No Interest Cost (annualized) history yet.</p>
      </div>
    );
  }

  if (entries.length === 1) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Interest Cost (annualized) Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded projection (
          {formatDateTime(entries[0].createdAt)}):{' '}
          {formatCurrency(annualizedInterestCostForEntry(entries[0]))} per year, projected at that
          snapshot&rsquo;s own debt and rate — not interest already paid.
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: annualizedInterestCostForEntry(entry),
  }));
  const chartSummary = `Interest Cost (annualized) trend — each point is a projected annual borrowing cost at that snapshot's own debt and rate, not a running or cumulative total: ${chartData
    .map((point) => `${point.timestamp} ${formatCurrency(point.value)} per year`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Interest Cost (annualized) Trend</h3>
      <div role="img" aria-label={chartSummary} className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              width={48}
              tick={{ fontSize: 10 }}
              tickFormatter={(value: number) => formatCurrency(value)}
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
  );
}
