'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';

import { formatCurrency, formatDateTime } from '../utils/format';

/**
 * Market Price Trend Section — v1.10.0 Batch 2 ("Dashboard Trend
 * Parity"). A compact, read-only historical view of the same "Market
 * Price" metric `app/portfolio/PortfolioHistoryPanel.tsx` already
 * charts — this component reads through the identical
 * `listPortfolioHistoryForPortfolio` service call (local component
 * state + effect, not a new persistence path or Zustand store), the
 * same architecture `HealthFactorTrendSection.tsx` (v1.7.0 Batch 1),
 * `LiquidationBufferTrendSection.tsx` (v1.8.0 Batch 1),
 * `AnnualizedInterestCostTrendSection.tsx` (v1.9.0 Batch 1), and
 * `NetWorthTrendSection.tsx`/`LoanToValueTrendSection.tsx` (v1.10.0
 * Batch 1) already established, extending the Dashboard's trend-chart
 * set to a metric Portfolio History has offered since v1.5.0 but the
 * Dashboard never surfaced.
 *
 * **Historical visualization only — a direct field read of an
 * already-persisted snapshot value, never a live oracle/data-source
 * lookup of its own.** Every plotted value is `entry.marketPriceUsd`
 * itself — the identical field `PortfolioHistoryPanel.tsx`'s own
 * `marketPrice` metric config already reads (see that file's
 * `PORTFOLIO_HISTORY_METRICS` table). This component never calls a
 * price API and never reads the live `aaveMarketQuote` snapshot
 * `DashboardSummaryHeader`'s own current-price line uses — it renders
 * only what was already recorded into Portfolio History at each
 * snapshot's own creation time, the same read-only, already-persisted
 * data source every sibling trend section uses.
 *
 * **Placed alongside the Liquidation-risk trend charts** (directly
 * after `LiquidationBufferTrendSection`), since Market Price is the
 * direct input `LiquidationRiskPanel`'s own current-value card and the
 * Liquidation Buffer trend both already depend on — not because this
 * component itself computes anything from it.
 *
 * **Always a plain, required number — no null handling, no
 * protocol-version branching.** `marketPriceUsd` is a required,
 * non-nullable `number` on every persisted entry regardless of
 * protocol version (`services/persistence/types/models.ts`), so this
 * component has no "no risk"/"not available" branch to render and
 * never reads `entry.protocolVersion`.
 *
 * **No risk-band classification, no color thresholds.** Same discipline
 * every sibling trend section already follows — this shows the raw
 * price and its trend only.
 *
 * **Fewer than two entries never renders a chart** — mirrors every
 * sibling trend section's own "no chart below two entries" rule
 * exactly. A single entry's own value is still shown as plain text, so
 * the component never silently shows nothing when real data exists —
 * but no second point is ever fabricated to make a line renderable.
 */
function marketPriceForEntry(entry: PersistedPortfolioHistoryEntry): number {
  return entry.marketPriceUsd;
}

export function MarketPriceTrendSection({
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
        <h3 className="text-sm font-medium text-foreground">Market Price Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Market Price Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Market Price Trend</h3>
        <p className="text-xs text-muted-foreground">No Market Price history yet.</p>
      </div>
    );
  }

  if (entries.length === 1) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Market Price Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded value (
          {formatDateTime(entries[0].createdAt)}): {formatCurrency(marketPriceForEntry(entries[0]))}
          .
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: marketPriceForEntry(entry),
  }));
  const chartSummary = `Market Price trend: ${chartData
    .map((point) => `${point.timestamp} ${formatCurrency(point.value)}`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Market Price Trend</h3>
      <div role="img" aria-label={chartSummary} className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              width={56}
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
