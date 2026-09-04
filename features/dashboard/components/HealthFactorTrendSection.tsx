'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';

import { formatDateTime, formatHealthFactor } from '../utils/format';

/**
 * Health Factor Trend Section — v1.7.0 Batch 1 ("Dashboard Health Factor
 * Trend Visibility"). A compact, read-only historical view of the same
 * `entry.healthFactor` values `PortfolioHistoryPanel.tsx`
 * (`app/portfolio/`) already charts — this component reads through the
 * identical `listPortfolioHistoryForPortfolio` service call (local
 * component state + effect, not a new persistence path or Zustand
 * store), so the Dashboard's "Am I safe?" question has a trend answer
 * without leaving the page.
 *
 * **Presentation/read-layer only.** Every value rendered here is taken
 * directly from an already-persisted `PortfolioHistoryEntry.healthFactor`
 * — never recomputed from today's portfolio state, today's market data,
 * or a new formula. `null` (zero-debt, Health Factor is Infinity) is
 * mapped to `Infinity` before formatting so it reuses this feature's own
 * `formatHealthFactor` exactly as it already renders a live zero-debt
 * Health Factor elsewhere on this Dashboard (`Intl.NumberFormat` renders
 * `Infinity` as "∞" natively) — no new nullable-formatting convention is
 * introduced.
 *
 * **No risk-band classification, no color thresholds.** This component
 * shows the raw number and its trend only — Conflict #1 (four mutually
 * disagreeing Health Factor band-threshold schemes across `01_PRD.md`
 * and `02_Formulas.md`) is unresolved, and inventing a scheme here would
 * repeat the exact mistake this project's own convention has
 * consistently avoided (see `buildHealthFactorStatus.ts`'s own "never
 * classifies risk" comment).
 *
 * **Fewer than two entries never renders a chart** — a one-point line
 * would not be a "trend," and Recharts has nothing meaningful to
 * interpolate between; this mirrors `PortfolioHistoryPanel.tsx`'s own
 * established "no chart below two entries" rule exactly. A single
 * entry's own value is still shown as plain text, so the component never
 * silently shows nothing when real data exists — but no second point is
 * ever fabricated to make a line renderable.
 *
 * **Table/chart parity is not a concern here the way it is in
 * `PortfolioHistoryPanel.tsx`** — there is no adjacent table on the
 * Dashboard duplicating these same numbers, so the chart's own
 * `aria-label` is the sole accessible summary of every plotted point
 * (not a supplement to a table already proving the same values), the
 * same "state every value in the text summary" discipline
 * `PortfolioHistoryPanel.tsx`'s own chart already follows.
 *
 * **No protocol-version branching.** `entry.healthFactor` is read
 * identically regardless of `entry.protocolVersion` — the same
 * "computed identically for both protocol versions" pattern every
 * Portfolio History metric already follows.
 */
function formatHistoricalHealthFactor(value: number | null): string {
  return formatHealthFactor(value === null ? Infinity : value);
}

export function HealthFactorTrendSection({
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
      // left-to-right chronological line, the same convention
      // `PortfolioHistoryPanel.tsx`'s own chart already uses.
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
        <h3 className="text-sm font-medium text-foreground">Health Factor Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Health Factor Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Health Factor Trend</h3>
        <p className="text-xs text-muted-foreground">No Health Factor history yet.</p>
      </div>
    );
  }

  if (entries.length === 1) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Health Factor Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded value (
          {formatDateTime(entries[0].createdAt)}):{' '}
          {formatHistoricalHealthFactor(entries[0].healthFactor)}.
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: entry.healthFactor,
  }));
  const chartSummary = `Health Factor trend: ${chartData
    .map((point) => `${point.timestamp} ${formatHistoricalHealthFactor(point.value)}`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Health Factor Trend</h3>
      <div role="img" aria-label={chartSummary} className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              width={32}
              tick={{ fontSize: 10 }}
              tickFormatter={(value: number) => formatHistoricalHealthFactor(value)}
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
