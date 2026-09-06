'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';

import { formatCurrency, formatDateTime } from '../utils/format';

/**
 * Collateral Value Trend Section — v1.14.0 Batch 1 ("Dashboard Trend
 * Parity, Part 2"). A compact, read-only historical view of the same
 * "Collateral Value" metric `app/portfolio/PortfolioHistoryPanel.tsx`
 * has charted since v1.12.0 Batch 1 — this component reads through the
 * identical `listPortfolioHistoryForPortfolio` service call (local
 * component state + effect, not a new persistence path or Zustand
 * store), the same architecture every sibling Dashboard trend section
 * (`NetWorthTrendSection.tsx`, `LeverageTrendSection.tsx`, etc.) already
 * established. Closes one of the five metrics the Post-v1.13.0 Roadmap
 * Audit found Portfolio History had gained (v1.12.0–v1.13.0) without a
 * matching Dashboard trend chart.
 *
 * **The canonical persisted field, read directly — no new formula, no
 * recomputation.** Every plotted value is `entry.collateral.valueUsd`
 * itself — the identical field `PortfolioHistoryPanel.tsx`'s own
 * `collateralValue` metric config already reads. This component never
 * recalculates a historical collateral value from today's market price,
 * and never queries a live oracle for a historical point — it renders
 * only what was already persisted.
 *
 * **Always a plain, required number — no null handling, no
 * protocol-version branching.** `collateral.valueUsd` is a required,
 * non-nullable field on every persisted entry regardless of protocol
 * version, so this component has no "no risk"/"not available" branch to
 * render and never reads `entry.protocolVersion`.
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
function collateralValueForEntry(entry: PersistedPortfolioHistoryEntry): number {
  return entry.collateral.valueUsd;
}

export function CollateralValueTrendSection({
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
        <h3 className="text-sm font-medium text-foreground">Collateral Value Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Collateral Value Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Collateral Value Trend</h3>
        <p className="text-xs text-muted-foreground">No Collateral Value history yet.</p>
      </div>
    );
  }

  if (entries.length === 1) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Collateral Value Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded value (
          {formatDateTime(entries[0].createdAt)}):{' '}
          {formatCurrency(collateralValueForEntry(entries[0]))}.
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: collateralValueForEntry(entry),
  }));
  const chartSummary = `Collateral Value trend: ${chartData
    .map((point) => `${point.timestamp} ${formatCurrency(point.value)}`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Collateral Value Trend</h3>
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
