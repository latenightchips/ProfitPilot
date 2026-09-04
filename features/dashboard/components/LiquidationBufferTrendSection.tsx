'use client';

import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import type { PersistedPortfolioHistoryEntry } from '@/services/persistence';
import { listPortfolioHistoryForPortfolio } from '@/services/persistence';
import { calculateLiquidationBufferPercent } from '@/services/portfolioHistory';

import { formatDateTime, formatPercent } from '../utils/format';

/**
 * Liquidation Buffer Trend Section — v1.8.0 Batch 1 ("Dashboard
 * Liquidation Buffer Trend Visibility"). A compact, read-only historical
 * view of the same derived buffer `app/portfolio/PortfolioHistoryPanel.tsx`
 * already charts as its "Liquidation Buffer" metric — this component
 * reads through the identical `listPortfolioHistoryForPortfolio` service
 * call (local component state + effect, not a new persistence path or
 * Zustand store), the same architecture `HealthFactorTrendSection.tsx`
 * (v1.7.0 Batch 1) already established, so the Dashboard's risk-trend
 * story pairs Health Factor with Liquidation Buffer.
 *
 * **Presentation/read-layer only, reusing the v1.6.0 helper verbatim.**
 * Every plotted value is `calculateLiquidationBufferPercent(
 * entry.marketPriceUsd, entry.liquidationPriceUsd)` — the exact
 * `services/portfolioHistory/` DISPLAY/SERVICE-LAYER DERIVED helper
 * `PortfolioHistoryPanel.tsx` already uses, computed only from that one
 * history entry's own `marketPriceUsd`/`liquidationPriceUsd` fields,
 * never from today's portfolio or market state. This is deliberately
 * NOT the Engine's separate F-025 `calculateLiquidationBuffer`
 * (`engine/liquidation/`, live-computed, percentage-scaled, feeding
 * `LiquidationRiskPanel`'s own current-value card) — the two are
 * intentionally distinct implementations of similar math (see
 * `calculateLiquidationBufferPercent.ts`'s own header comment); this
 * component never substitutes or conflates them, and introduces no new
 * Formula ID.
 *
 * **`null` means "no liquidation risk," never a fabricated `0%`.** The
 * v1.6.0 helper returns `null` both when `liquidationPriceUsd` is `null`
 * (zero-debt) and when the `marketPriceUsd` denominator is invalid
 * (non-finite or `<= 0`) — this component cannot and does not
 * distinguish those two cases, matching the helper's own contract
 * exactly; both render "No liquidation risk," the same established text
 * `PortfolioHistoryPanel.tsx`'s own `formatLiquidationBufferPercent`
 * already uses. Positive, zero, and negative buffers are all rendered
 * as-is, never clamped.
 *
 * **No risk-band classification, no color thresholds.** Same discipline
 * `HealthFactorTrendSection.tsx` already follows — this shows the raw
 * percentage and its trend only.
 *
 * **Fewer than two entries never renders a chart** — mirrors
 * `HealthFactorTrendSection.tsx`'s own "no chart below two entries" rule
 * exactly. A single entry's own value is still shown as plain text, so
 * the component never silently shows nothing when real data exists —
 * but no second point is ever fabricated to make a line renderable.
 *
 * **No protocol-version branching.** `calculateLiquidationBufferPercent`
 * takes only `marketPriceUsd`/`liquidationPriceUsd` and never reads
 * `entry.protocolVersion` — the same "computed identically for both
 * protocol versions" pattern every Portfolio History metric follows.
 */
function formatHistoricalLiquidationBufferPercent(value: number | null): string {
  if (value === null) return 'No liquidation risk';
  return formatPercent(value);
}

function bufferForEntry(entry: PersistedPortfolioHistoryEntry): number | null {
  return calculateLiquidationBufferPercent(entry.marketPriceUsd, entry.liquidationPriceUsd);
}

export function LiquidationBufferTrendSection({
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
      // `HealthFactorTrendSection.tsx`'s own chart already uses.
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
        <h3 className="text-sm font-medium text-foreground">Liquidation Buffer Trend</h3>
        <p className="text-xs text-muted-foreground">Loading history…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Liquidation Buffer Trend</h3>
        <p className="text-xs text-muted-foreground">History could not be loaded.</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Liquidation Buffer Trend</h3>
        <p className="text-xs text-muted-foreground">No Liquidation Buffer history yet.</p>
      </div>
    );
  }

  if (entries.length === 1) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Liquidation Buffer Trend</h3>
        <p className="text-xs text-muted-foreground">
          Not enough history yet to show a trend. Latest recorded value (
          {formatDateTime(entries[0].createdAt)}):{' '}
          {formatHistoricalLiquidationBufferPercent(bufferForEntry(entries[0]))}.
        </p>
      </div>
    );
  }

  const chartData = [...entries].reverse().map((entry) => ({
    timestamp: formatDateTime(entry.createdAt),
    value: bufferForEntry(entry),
  }));
  const chartSummary = `Liquidation Buffer trend: ${chartData
    .map((point) => `${point.timestamp} ${formatHistoricalLiquidationBufferPercent(point.value)}`)
    .join(', ')}`;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Liquidation Buffer Trend</h3>
      <div role="img" aria-label={chartSummary} className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="timestamp" hide />
            <YAxis
              width={32}
              tick={{ fontSize: 10 }}
              tickFormatter={(value: number) => formatHistoricalLiquidationBufferPercent(value)}
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
