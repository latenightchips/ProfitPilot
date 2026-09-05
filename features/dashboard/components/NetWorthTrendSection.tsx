'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';

import { formatCurrency, formatDateTime } from '../utils/format';

/**
 * Net Worth Trend Section — v1.10.0 Batch 1 ("Dashboard Trend Parity").
 * A compact, read-only historical view of the same "Net Worth" metric
 * `app/portfolio/PortfolioHistoryPanel.tsx` already charts — this
 * component reads through the identical `listPortfolioHistoryForPortfolio`
 * service call (local component state + effect, not a new persistence
 * path or Zustand store), the same architecture `HealthFactorTrendSection.tsx`
 * (v1.7.0 Batch 1), `LiquidationBufferTrendSection.tsx` (v1.8.0 Batch 1),
 * and `AnnualizedInterestCostTrendSection.tsx` (v1.9.0 Batch 1) already
 * established, extending the Dashboard's trend-chart set to a metric
 * Portfolio History has offered since v1.3.0 but the Dashboard never
 * surfaced.
 *
 * **Exactly `docs/02_Formulas.md`'s own "Net Worth = Portfolio Value −
 * Debt" equation, applied to one already-persisted snapshot.** Every
 * plotted value is `entry.collateral.valueUsd - entry.debt.valueUsd` —
 * the identical derivation `PortfolioHistoryPanel.tsx`'s own `netWorth`
 * metric config already uses (see that file's `PORTFOLIO_HISTORY_METRICS`
 * table). No new formula, no Engine involvement, no new Formula ID —
 * this is arithmetic over two already-persisted fields, not a
 * recomputation from today's portfolio or market state.
 *
 * **Always a plain, derived number — no null handling, no
 * protocol-version branching.** `collateral.valueUsd` and
 * `debt.valueUsd` are both required, non-nullable fields on every
 * persisted entry regardless of protocol version, so the subtraction is
 * always a finite number — this component has no "no risk"/"not
 * available" branch to render and never reads `entry.protocolVersion`.
 *
 * **No risk-band classification, no color thresholds.** Same discipline
 * every sibling trend section already follows — this shows the raw
 * value and its trend only.
 *
 * **Fewer than two entries never renders a chart** — mirrors every
 * sibling trend section's own "no chart below two entries" rule
 * exactly. A single entry's own value is still shown as plain text, so
 * the component never silently shows nothing when real data exists —
 * but no second point is ever fabricated to make a line renderable.
 */
function netWorthForEntry(entry: PersistedPortfolioHistoryEntry): number {
  return entry.collateral.valueUsd - entry.debt.valueUsd;
}

export function NetWorthTrendSection({
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
        <h3 className="text-sm font-medium text-foreground">Net Worth Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Net Worth Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Net Worth Trend</h3>
        <p className="text-xs text-muted-foreground">No Net Worth history yet.</p>
      </div>
    );
  }

  if (entries.length === 1) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Net Worth Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded value (
          {formatDateTime(entries[0].createdAt)}): {formatCurrency(netWorthForEntry(entries[0]))}.
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: netWorthForEntry(entry),
  }));
  const chartSummary = `Net Worth trend: ${chartData
    .map((point) => `${point.timestamp} ${formatCurrency(point.value)}`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Net Worth Trend</h3>
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
