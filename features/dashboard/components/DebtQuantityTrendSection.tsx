'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';

import { formatDateTime, formatQuantity } from '../utils/format';

/**
 * Debt Quantity Trend Section — v1.14.0 Batch 2 ("Dashboard Trend
 * Parity, Part 2"). A compact, read-only historical view of the same
 * "Debt Quantity" metric `app/portfolio/PortfolioHistoryPanel.tsx` has
 * charted since v1.12.0 Batch 3 — this component reads through the
 * identical `listPortfolioHistoryForPortfolio` service call (local
 * component state + effect, not a new persistence path or Zustand
 * store), the same architecture every sibling Dashboard trend section
 * (`NetWorthTrendSection.tsx`, `DebtValueTrendSection.tsx`, etc.) already
 * established. Closes one of the four remaining metrics the
 * Post-v1.13.0 Roadmap Audit found Portfolio History had gained
 * (v1.12.0–v1.13.0) without a matching Dashboard trend chart.
 *
 * **The canonical persisted native quantity, read directly — no
 * derivation from USD value or price.** Every plotted value is
 * `entry.debt.quantity` itself — the identical field
 * `PortfolioHistoryPanel.tsx`'s own `debtQuantity` metric config
 * already reads — never `debt.valueUsd / marketPriceUsd` or any other
 * back-calculation. This component never recalculates a historical debt
 * quantity, and never queries a live oracle or the current Aave market
 * for a historical point — it renders only what was already persisted.
 *
 * **The persisted debt asset is a free `string`, not a fixed literal —
 * the exact same "asset can change between snapshots" semantics
 * `PortfolioHistoryPanel.tsx`'s own `debtQuantity`/`formatDebtQuantity`
 * already established (v1.12.0 Batch 3) are preserved here, not
 * reinvented.** A quantity number alone is meaningless without knowing
 * which asset it is denominated in, and `PersistedPortfolioHistoryEntry.debt.asset`
 * is never assumed to match the portfolio's *current* debt asset for a
 * historical point:
 *   - The **Y-axis tick labels** use one representative entry (the most
 *     recent, `entries[0]`) for their compact scale text — Recharts hands
 *     an axis `tickFormatter` only the raw tick value, never the
 *     originating data point, so no tick can correctly carry a per-point
 *     asset symbol. This is exactly `PortfolioHistoryPanel.tsx`'s own
 *     documented compromise for its identical `debtQuantity` Y-axis, not
 *     a new one.
 *   - The **accessible `aria-label` chart summary** is fully accurate:
 *     each plotted point carries its own `entry`, so each point's own
 *     text states its own snapshot's real `debt.asset` symbol — a
 *     screen-reader user is never given a merged or averaged unit. If
 *     the debt asset changed between snapshots, that change is visible
 *     in the summary text itself (each point names its own asset), never
 *     smoothed over or hidden.
 *   - The **single-entry state** reads that one entry's own `debt.asset`
 *     directly — no representative-entry compromise is needed there,
 *     since there is only one point to describe.
 *
 * **No risk-band classification, no color thresholds, no
 * protocol-version branching.** Same discipline every sibling trend
 * section already follows — this shows the raw value and its trend
 * only, and never reads `entry.protocolVersion`.
 *
 * **Fewer than two entries never renders a chart** — mirrors every
 * sibling trend section's own "no chart below two entries" rule
 * exactly. A single entry's own value is still shown as plain text, so
 * the component never silently shows nothing when real data exists —
 * but no second point is ever fabricated to make a line renderable.
 */
function debtQuantityForEntry(entry: PersistedPortfolioHistoryEntry): number {
  return entry.debt.quantity;
}

function formatDebtQuantity(value: number, assetSymbol?: string): string {
  const formatted = formatQuantity(value);
  return assetSymbol ? `${formatted} ${assetSymbol}` : formatted;
}

export function DebtQuantityTrendSection({
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
        <h3 className="text-sm font-medium text-foreground">Debt Quantity Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Debt Quantity Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Debt Quantity Trend</h3>
        <p className="text-xs text-muted-foreground">No Debt Quantity history yet.</p>
      </div>
    );
  }

  if (entries.length === 1) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Debt Quantity Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded value (
          {formatDateTime(entries[0].createdAt)}):{' '}
          {formatDebtQuantity(debtQuantityForEntry(entries[0]), entries[0].debt.asset)}.
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: debtQuantityForEntry(entry),
    entry,
  }));
  const chartSummary = `Debt Quantity trend: ${chartData
    .map((point) => `${point.timestamp} ${formatDebtQuantity(point.value, point.entry.debt.asset)}`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Debt Quantity Trend</h3>
      <div role="img" aria-label={chartSummary} className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              width={72}
              tick={{ fontSize: 10 }}
              tickFormatter={(value: number) =>
                // Recharts hands the axis formatter only the raw tick
                // value, never the originating entry — a single
                // representative entry (the most recent) is used only
                // for this compact scale label; the fully accurate,
                // per-point debt asset symbol is what the accessible
                // `chartSummary` aria-label above actually states. The
                // same documented compromise `PortfolioHistoryPanel.tsx`'s
                // own `debtQuantity` Y-axis already established.
                formatDebtQuantity(value, entries[0]?.debt.asset)
              }
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
