'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';

import { formatDateTime, formatPercent } from '../utils/format';

/**
 * Borrow APR Trend Section — v1.11.0 Batch 2 ("Borrow APR Trend
 * Completion"). A compact, read-only historical view of the same
 * "Borrow APR" metric `app/portfolio/PortfolioHistoryPanel.tsx`
 * already charts (v1.11.0 Batch 1) — this component reads through the
 * identical `listPortfolioHistoryForPortfolio` service call (local
 * component state + effect, not a new persistence path or Zustand
 * store), the same architecture every sibling Dashboard trend section
 * already established.
 *
 * **The canonical persisted field, read directly — no new formula, no
 * recomputation.** Every plotted value is `entry.borrowApr` itself —
 * the identical field `PortfolioHistoryPanel.tsx`'s own `borrowApr`
 * metric config already reads. This component never recalculates a
 * historical Borrow APR from today's portfolio state, and never
 * queries a live oracle or the current Aave market for a historical
 * point — it renders only what was already persisted.
 *
 * **`undefined` means "Not available," never a fabricated `0%`.** Per
 * the field's own established contract (`services/persistence/types/models.ts`:
 * "`undefined` only when genuinely unavailable — a V4 portfolio with no
 * synced debt state yet — never a fabricated 0") and the v1.11.0
 * IMPLEMENTATION APPROVAL's own Decision 1, an `undefined` observation
 * is never turned into `0`, never interpolated, never inferred from
 * another value, and never recomputed. It is converted to `null` only
 * to reuse the existing nullable-chart-point plumbing
 * `LiquidationPriceTrendSection.tsx` already established (so Recharts
 * renders a gap, not a point, at that position) and rendered as the
 * distinct text **"Not available"** — deliberately different wording
 * from `LiquidationPriceTrendSection.tsx`'s own `null` case ("No
 * liquidation risk"), since the two `null`s mean unrelated things (a
 * genuinely-missing observation vs. a computed zero-debt state) and
 * Decision 1 explicitly forbids generalizing one convention to the
 * other.
 *
 * **A chart needs at least two *usable* (non-`undefined`) Borrow APR
 * observations, not merely two persisted entries.** This is the one
 * respect in which this component's threshold differs from every prior
 * sibling trend section (which all gate on raw entry count): a V4
 * portfolio can accumulate many persisted entries while its debt state
 * has never synced, so `entries.length >= 2` alone would not guarantee
 * a meaningful line. When fewer than two entries carry a defined
 * `borrowApr`, the component falls back to the same "not enough
 * history yet" text every sibling section uses for a single entry,
 * describing the most recently recorded entry's own value (which may
 * itself be "Not available") rather than fabricating a second point.
 *
 * **No risk-band classification, no color thresholds, no V3/V4
 * branching.** Same discipline every sibling trend section already
 * follows — this component never reads `entry.protocolVersion` itself;
 * a V3 entry and a V4 entry with synced debt state render identically.
 *
 * **Fewer than two usable entries never renders a chart** — the same
 * "no chart below two [usable] entries" rule every sibling trend
 * section already follows, adapted for this field's own
 * possibly-`undefined` values. A single usable entry's own value is
 * still shown as plain text, so the component never silently shows
 * nothing when real data exists — but no second point is ever
 * fabricated to make a line renderable.
 */
function formatHistoricalBorrowApr(value: number | null): string {
  if (value === null) return 'Not available';
  return formatPercent(value);
}

function borrowAprForEntry(entry: PersistedPortfolioHistoryEntry): number | null {
  return entry.borrowApr ?? null;
}

export function BorrowAprTrendSection({
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
        <h3 className="text-sm font-medium text-foreground">Borrow APR Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Borrow APR Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Borrow APR Trend</h3>
        <p className="text-xs text-muted-foreground">No Borrow APR history yet.</p>
      </div>
    );
  }

  const usableCount = entries.filter((entry) => entry.borrowApr !== undefined).length;

  if (usableCount < 2) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Borrow APR Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded value (
          {formatDateTime(entries[0].createdAt)}):{' '}
          {formatHistoricalBorrowApr(borrowAprForEntry(entries[0]))}.
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: borrowAprForEntry(entry),
  }));
  const chartSummary = `Borrow APR trend: ${chartData
    .map((point) => `${point.timestamp} ${formatHistoricalBorrowApr(point.value)}`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Borrow APR Trend</h3>
      <div role="img" aria-label={chartSummary} className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              width={56}
              tick={{ fontSize: 10 }}
              tickFormatter={(value: number) => formatHistoricalBorrowApr(value)}
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
