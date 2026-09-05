'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';

import { formatCurrency, formatDateTime } from '../utils/format';

/**
 * Liquidation Price Trend Section — v1.10.0 Batch 3 ("Dashboard Trend
 * Parity"). A compact, read-only historical view of the same
 * "Liquidation Price" metric `app/portfolio/PortfolioHistoryPanel.tsx`
 * already charts — this component reads through the identical
 * `listPortfolioHistoryForPortfolio` service call (local component
 * state + effect, not a new persistence path or Zustand store), the
 * same architecture `HealthFactorTrendSection.tsx` (v1.7.0 Batch 1),
 * `LiquidationBufferTrendSection.tsx` (v1.8.0 Batch 1),
 * `AnnualizedInterestCostTrendSection.tsx` (v1.9.0 Batch 1), and
 * `NetWorthTrendSection.tsx`/`LoanToValueTrendSection.tsx`/
 * `LeverageTrendSection.tsx`/`MarketPriceTrendSection.tsx` (v1.10.0
 * Batches 1–2) already established, completing the Dashboard's mirror
 * of every metric Portfolio History's own chart selector offers.
 *
 * **The canonical persisted field, read directly — no new formula, no
 * recomputation.** Every plotted value is `entry.liquidationPriceUsd`
 * itself — the identical field `PortfolioHistoryPanel.tsx`'s own
 * `liquidationPrice` metric config already reads (see that file's
 * `PORTFOLIO_HISTORY_METRICS` table), and the same field
 * `buildPortfolioHistoryEntry.ts` populates once, at record time, from
 * `summary.liquidation?.price ?? null` — that snapshot's own
 * Engine-computed liquidation price at the moment it was recorded. This
 * component never recalculates a historical liquidation price from
 * today's portfolio state, and never queries a live oracle or the
 * current Aave market price for a historical point — it renders only
 * what was already persisted, the same read-only discipline every
 * sibling trend section follows.
 *
 * **`null` means "no liquidation risk," never a fabricated `0` or a
 * dropped point.** Per the field's own established contract (mirrored
 * from `PortfolioLiquidationSummary`'s own `null` case, and identical
 * to the "no liquidation risk" semantics `LiquidationBufferTrendSection.tsx`
 * already handles for the same underlying zero-debt condition), a
 * `null` entry renders "No liquidation risk" — the same text
 * `PortfolioHistoryPanel.tsx`'s own `formatLiquidationPrice` already
 * uses — both in the single-entry text branch and inline in the
 * multi-entry chart's own `aria-label` summary, so a zero-debt snapshot
 * is never silently omitted from the accessible record even though
 * Recharts itself renders no point for a `null` data value at that
 * position.
 *
 * **No risk-band classification, no color thresholds, no V3/V4
 * branching.** Same discipline every sibling trend section already
 * follows — `entry.liquidationPriceUsd` is computed identically for
 * both protocol versions upstream (Engine-side), and this component
 * never reads `entry.protocolVersion` itself.
 *
 * **Fewer than two entries never renders a chart** — mirrors every
 * sibling trend section's own "no chart below two entries" rule
 * exactly. A single entry's own value is still shown as plain text, so
 * the component never silently shows nothing when real data exists —
 * but no second point is ever fabricated to make a line renderable.
 */
function formatHistoricalLiquidationPrice(value: number | null): string {
  if (value === null) return 'No liquidation risk';
  return formatCurrency(value);
}

function liquidationPriceForEntry(entry: PersistedPortfolioHistoryEntry): number | null {
  return entry.liquidationPriceUsd;
}

export function LiquidationPriceTrendSection({
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
        <h3 className="text-sm font-medium text-foreground">Liquidation Price Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Liquidation Price Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Liquidation Price Trend</h3>
        <p className="text-xs text-muted-foreground">No Liquidation Price history yet.</p>
      </div>
    );
  }

  if (entries.length === 1) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Liquidation Price Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded value (
          {formatDateTime(entries[0].createdAt)}):{' '}
          {formatHistoricalLiquidationPrice(liquidationPriceForEntry(entries[0]))}.
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: liquidationPriceForEntry(entry),
  }));
  const chartSummary = `Liquidation Price trend: ${chartData
    .map((point) => `${point.timestamp} ${formatHistoricalLiquidationPrice(point.value)}`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Liquidation Price Trend</h3>
      <div role="img" aria-label={chartSummary} className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              width={56}
              tick={{ fontSize: 10 }}
              tickFormatter={(value: number) => formatHistoricalLiquidationPrice(value)}
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
