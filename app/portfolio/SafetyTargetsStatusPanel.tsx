'use client';

import { Fragment } from 'react';

import {
  buildSafetyTargetsStatus,
  type PortfolioSummary,
  type SafetyTargetComparison,
  type ServiceResult,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';

/**
 * Safety Targets Status panel — v1.23.0 Batch 1 ("Portfolio Page Safety
 * Targets Status Panel"). Read-only: renders
 * `buildSafetyTargetsStatus`'s (`@/services/portfolio`) already-computed
 * comparison directly — this component performs no comparison logic of
 * its own, only formatting, matching `StartingValueBaselinePanel.tsx`'s
 * own "renders an already-computed result" precedent for a sibling
 * read-only panel on this exact page. Structure mirrors that panel's own
 * `<dl>` grid (`grid-cols-2`, `dt`/`dd` label-value pairs).
 *
 * **No Set/Reset/edit control here.** Configuring Safety Targets remains
 * exclusively the "Safety target settings" fieldset
 * (`PortfolioPageClient.tsx`) — the same read-only/configuration
 * separation `StartingValueBaselineSection.tsx` (Dashboard) already
 * establishes for the Starting-Value Baseline.
 *
 * **Each of the four targets is independent** — a missing target reads
 * "Not configured" for that field alone; the other three still render
 * normally. A `PortfolioSummary` calculation failure only affects the
 * two fields that depend on it (Target Health Factor, Safety Buffer %)
 * — Target BTC Price and Holding Period are always computable directly
 * from `portfolio` and render normally regardless.
 */
function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

/** `Intl.NumberFormat` renders `Infinity` as "∞" natively — correct for a zero-debt portfolio's Health Factor, matching `PortfolioPageClient.tsx`'s own `formatHealthFactor`. */
function formatHealthFactor(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

/** For a value already on a 0–100 scale (this panel's own `safetyBufferPercent` comparison, converted by `buildSafetyTargetsStatus` itself) — divides by 100 before the `Intl` percent formatter, the same convention `features/dashboard/utils/format.ts`'s own `formatPercentagePoints` documents. */
function formatPercentagePoints(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(
    value / 100,
  );
}

function formatDays(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

/**
 * `unavailableText` distinguishes the two real causes behind
 * `status: 'unavailable'`: a failed `PortfolioSummary` (any comparison
 * that depends on it) vs. Safety Buffer % specifically on a zero-debt
 * portfolio, which has no liquidation risk to measure a buffer against
 * — the same established "No liquidation risk" text
 * `PortfolioHistoryPanel.tsx` already uses for that exact fact, never a
 * fabricated "0%" or a generic "Not available" that would blur a real
 * zero with an inapplicable comparison.
 */
function statusText(comparison: SafetyTargetComparison, unavailableText: string): string {
  switch (comparison.status) {
    case 'met':
      return 'Met';
    case 'not_met':
      return 'Not met';
    case 'not_configured':
      return 'Not configured';
    case 'unavailable':
      return unavailableText;
  }
}

interface StatusRow {
  key: string;
  label: string;
  summaryLine: string;
}

function buildRows(portfolio: Portfolio, summary: ServiceResult<PortfolioSummary>): StatusRow[] {
  const status = buildSafetyTargetsStatus(portfolio, summary);

  const healthFactor = status.targetHealthFactor;
  const holdingPeriod = status.holdingPeriodDays;
  const btcPrice = status.targetBtcPriceUsd;
  const buffer = status.safetyBufferPercent;

  return [
    {
      key: 'targetHealthFactor',
      label: 'Target Health Factor',
      summaryLine: `Target: ${
        healthFactor.target === null ? '—' : formatHealthFactor(healthFactor.target)
      } · Current: ${
        healthFactor.current === null ? '—' : formatHealthFactor(healthFactor.current)
      } · ${statusText(healthFactor, 'Not available')}`,
    },
    {
      key: 'holdingPeriodDays',
      label: 'Holding period (days)',
      summaryLine: `Target: ${
        holdingPeriod.target === null ? '—' : `${formatDays(holdingPeriod.target)} days`
      } · Current: ${
        holdingPeriod.current === null ? '—' : `${formatDays(holdingPeriod.current)} days elapsed`
      } · ${statusText(holdingPeriod, 'Not available')}`,
    },
    {
      key: 'targetBtcPriceUsd',
      label: 'Target BTC price (USD)',
      summaryLine: `Target: ${
        btcPrice.target === null ? '—' : formatCurrency(btcPrice.target)
      } · Current: ${
        btcPrice.current === null ? '—' : formatCurrency(btcPrice.current)
      } · ${statusText(btcPrice, 'Not available')}`,
    },
    {
      key: 'safetyBufferPercent',
      label: 'Safety buffer (%)',
      summaryLine: `Target: ${
        buffer.target === null ? '—' : formatPercentagePoints(buffer.target)
      } · Current: ${
        buffer.current === null ? '—' : formatPercentagePoints(buffer.current)
      } · ${statusText(buffer, summary.ok ? 'No liquidation risk to compare against' : 'Not available')}`,
    },
  ];
}

export function SafetyTargetsStatusPanel({
  portfolio,
  summary,
}: {
  portfolio: Portfolio;
  summary: ServiceResult<PortfolioSummary>;
}) {
  const rows = buildRows(portfolio, summary);

  return (
    <section aria-labelledby="safety-targets-status-heading" className="flex flex-col gap-3">
      <h2 id="safety-targets-status-heading" className="text-sm font-semibold text-foreground">
        Safety Targets Status
      </h2>
      <p className="text-xs text-muted-foreground">
        How your current numbers compare to the safety targets configured above. Read-only — change
        your targets in the fieldset above.
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {rows.map((row) => (
          <Fragment key={row.key}>
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-foreground">{row.summaryLine}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
