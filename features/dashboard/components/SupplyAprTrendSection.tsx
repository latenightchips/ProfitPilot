'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';

import { formatDateTime, formatPercent } from '../utils/format';

/**
 * Supply APR Trend Section — v1.14.0 Batch 3 ("Dashboard Trend Parity,
 * Part 2"), the final batch of this release's roadmap. A compact,
 * read-only historical view of the same "Supply APR" metric
 * `app/portfolio/PortfolioHistoryPanel.tsx` has charted since v1.13.0
 * Batch 2 — this component reads through the identical
 * `listPortfolioHistoryForPortfolio` service call (local component
 * state + effect, not a new persistence path or Zustand store), the
 * same architecture every sibling Dashboard trend section
 * (`BorrowAprTrendSection.tsx` most directly) already established.
 * Closes the last of the five metrics the Post-v1.13.0 Roadmap Audit
 * found Portfolio History had gained without a matching Dashboard
 * trend chart.
 *
 * **The canonical persisted field, read directly — no new formula, no
 * recomputation.** Every plotted value is `entry.supplyApr` itself —
 * the identical field `PortfolioHistoryPanel.tsx`'s own `supplyApr`
 * metric config already reads. This component never recalculates a
 * historical Supply APR from utilization, reserve data, rates, or any
 * other field, and never queries a live oracle or the current Aave
 * market for a historical point — it renders only what was already
 * persisted.
 *
 * **`undefined` means "Not applicable," never "Not available" —
 * a deliberately different wording from `BorrowAprTrendSection.tsx`'s
 * own `undefined` case, because the two mean structurally different
 * things.** Per `PersistedPortfolioHistoryEntry.supplyApr`'s own
 * established contract (`services/persistence/types/models.ts`:
 * "`undefined` for every V4 portfolio, unconditionally — mirrors
 * `resolveSupplyAprDisplay`'s own `'not-applicable'` case") and
 * `PortfolioHistoryPanel.tsx`'s own `formatSupplyApr`, a V4 entry's
 * `supplyApr` is not a value pending a future sync the way
 * `borrowApr` can be for V4 — no V4-facing form or live boundary in
 * this codebase ever produces a V3-shaped supply rate for V4, so the
 * gap is *permanent* for that entry, not temporary. This component
 * preserves that exact distinction rather than reusing
 * `BorrowAprTrendSection.tsx`'s wording, which would wrongly imply a
 * pending state that does not exist for Supply APR. It is converted to
 * `null` only to reuse the existing nullable-chart-point plumbing every
 * sibling trend section already established (so Recharts renders a
 * gap, not a fabricated point, at that position).
 *
 * **Strict V3/V4 semantic isolation — no protocol-version branching of
 * this component's own, and no cross-version normalization.** This
 * component never reads `entry.protocolVersion` and never invents a
 * substitute value for a V4 entry's permanently-`undefined` Supply
 * APR — the producer (`services/portfolioHistory/buildPortfolioHistoryEntry.ts`),
 * not this presentation layer, is where that isolation already lives,
 * the same discipline `PortfolioHistoryPanel.tsx`'s own Debt Quantity
 * metric doc comment already establishes for a different field. A
 * portfolio's history that mixes V3 and V4 entries (e.g. one that
 * switched protocol versions, `AaveProtocolVersionForm.tsx`) is handled
 * correctly by the same `undefined`-filtering mechanism below, with no
 * special-case branch: each V3 entry's real Supply APR plots normally,
 * each V4 entry is excluded from the "usable" count and renders as a
 * gap in the line — exactly as truthful as reading each entry's own
 * persisted field, never merged, averaged, or carried forward from a
 * different protocol version's entry.
 *
 * **A chart needs at least two *usable* (non-`undefined`) Supply APR
 * observations, not merely two persisted entries** — the identical
 * threshold rule `BorrowAprTrendSection.tsx` already established, since
 * a V4-only (or V4-heavy) portfolio can accumulate many persisted
 * entries with none of them carrying a Supply APR at all. When fewer
 * than two entries carry a defined `supplyApr`, the component falls
 * back to the same "not enough history yet" text every sibling section
 * uses for a single entry, describing the most recently recorded
 * entry's own value (which may itself be "Not applicable") rather than
 * fabricating a second point.
 *
 * **No risk-band classification, no color thresholds.** Same discipline
 * every sibling trend section already follows — this shows the raw
 * value and its trend only.
 *
 * **Fewer than two usable entries never renders a chart** — the same
 * "no chart below two [usable] entries" rule every sibling trend
 * section already follows, adapted for this field's own
 * possibly-`undefined` values. A single usable entry's own value is
 * still shown as plain text, so the component never silently shows
 * nothing when real data exists — but no second point is ever
 * fabricated to make a line renderable.
 */
function formatHistoricalSupplyApr(value: number | null): string {
  if (value === null) return 'Not applicable';
  return formatPercent(value);
}

function supplyAprForEntry(entry: PersistedPortfolioHistoryEntry): number | null {
  return entry.supplyApr ?? null;
}

export function SupplyAprTrendSection({
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
        <h3 className="text-sm font-medium text-foreground">Supply APR Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Supply APR Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Supply APR Trend</h3>
        <p className="text-xs text-muted-foreground">No Supply APR history yet.</p>
      </div>
    );
  }

  const usableCount = entries.filter((entry) => entry.supplyApr !== undefined).length;

  if (usableCount < 2) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Supply APR Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded value (
          {formatDateTime(entries[0].createdAt)}):{' '}
          {formatHistoricalSupplyApr(supplyAprForEntry(entries[0]))}.
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: supplyAprForEntry(entry),
  }));
  const chartSummary = `Supply APR trend: ${chartData
    .map((point) => `${point.timestamp} ${formatHistoricalSupplyApr(point.value)}`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Supply APR Trend</h3>
      <div role="img" aria-label={chartSummary} className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              width={56}
              tick={{ fontSize: 10 }}
              tickFormatter={(value: number) => formatHistoricalSupplyApr(value)}
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
