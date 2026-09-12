/**
 * Safety Targets Status Summary builder — v1.23.0 Batch 2 (Dashboard
 * Safety Targets Status Integration). See
 * `../types/safetyTargetsStatusSummary.ts` for the full design
 * reasoning.
 *
 * **Derives no comparison of its own.** Calls `buildSafetyTargetsStatus`
 * (`services/portfolio/safetyTargetsStatus.ts`, v1.23.0 Batch 1) — the
 * same canonical function `app/portfolio/SafetyTargetsStatusPanel.tsx`
 * already calls — and only formats its already-computed
 * `target`/`current`/`status` fields for direct render, the same
 * "builder formats, component only renders strings" division of labor
 * `buildStartingValueBaselineSummary.ts` already establishes. No
 * arithmetic, no comparison (`>=`, `<`, etc.) of the underlying numbers
 * happens in this file — every comparison is already resolved by the
 * Service call above. `status` is copied onto each row verbatim, never
 * re-derived from a formatted string.
 *
 * **Reuses the Dashboard's own existing formatting helpers**
 * (`formatCurrency`/`formatHealthFactor`/`formatPercentagePoints`,
 * `./format.ts`) rather than redefining them — unlike
 * `app/portfolio/SafetyTargetsStatusPanel.tsx`, which had to define its
 * own local copies because the Portfolio page's own `format.ts`-
 * equivalent lives inline in `PortfolioPageClient.tsx`, not as an
 * importable module. `formatDays` is the one genuinely new helper here
 * (no existing Dashboard helper formats a whole-day count); it performs
 * no calendar arithmetic of its own — `buildSafetyTargetsStatus` has
 * already computed the elapsed-day integer.
 *
 * **Status label text (Safety Targets Semantic/Status Cleanup batch)
 * comes from `formatSafetyTargetStatusLabel`
 * (`services/portfolio/safetyTargetsStatus.ts`), the single canonical
 * mapping this file and `app/portfolio/SafetyTargetsStatusPanel.tsx`
 * both call** — no longer each surface's own independent, identical
 * copy of the same switch (the pre-v1.25 "each page/feature owns its
 * formatting layer" convention this file previously followed here),
 * since the target-family-specific vocabulary this batch introduces
 * (e.g. Target BTC Price's "Target reached" vs. Target Health Factor's
 * "Met") is exactly the kind of shared meaning two independently
 * hand-maintained copies could silently drift apart on. `unavailableText`
 * stays resolved here (it needs `summary.ok`, not part of
 * `SafetyTargetComparison`) and passed in — "Not available" everywhere
 * except Safety Buffer % on a zero-debt portfolio, "No liquidation risk
 * to compare against" (the same established text `PortfolioHistoryPanel.tsx`
 * already uses for that exact fact). The underlying `status` value
 * driving the text is always the canonical Service's own, never a
 * second interpretation of it.
 */
import {
  buildSafetyTargetsStatus,
  formatSafetyTargetStatusLabel,
  type PortfolioSummary,
  SAFETY_BUFFER_INVALID_TARGET_EXPLANATION,
  type ServiceResult,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type {
  SafetyTargetRowSummary,
  SafetyTargetsStatusSummary,
} from '../types/safetyTargetsStatusSummary';
import { formatCurrency, formatHealthFactor, formatPercentagePoints } from './format';

function formatDays(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function buildSafetyTargetsStatusSummary(
  portfolio: Portfolio,
  summary: ServiceResult<PortfolioSummary>,
): SafetyTargetsStatusSummary {
  const status = buildSafetyTargetsStatus(portfolio, summary);

  const rows: SafetyTargetRowSummary[] = [
    {
      key: 'targetHealthFactor',
      label: 'Target Health Factor',
      status: status.targetHealthFactor.status,
      detailFormatted: `Target: ${
        status.targetHealthFactor.target === null
          ? '—'
          : formatHealthFactor(status.targetHealthFactor.target)
      } · Current: ${
        status.targetHealthFactor.current === null
          ? '—'
          : formatHealthFactor(status.targetHealthFactor.current)
      }`,
      statusLabel: formatSafetyTargetStatusLabel(
        'targetHealthFactor',
        status.targetHealthFactor,
        'Not available',
      ),
    },
    {
      key: 'holdingPeriodDays',
      label: 'Holding Period',
      status: status.holdingPeriodDays.status,
      detailFormatted: `Target: ${
        status.holdingPeriodDays.target === null
          ? '—'
          : `${formatDays(status.holdingPeriodDays.target)} days`
      } · Current: ${
        status.holdingPeriodDays.current === null
          ? '—'
          : `${formatDays(status.holdingPeriodDays.current)} days elapsed`
      }`,
      statusLabel: formatSafetyTargetStatusLabel(
        'holdingPeriodDays',
        status.holdingPeriodDays,
        'Not available',
      ),
    },
    {
      key: 'targetBtcPriceUsd',
      label: 'Target BTC Price',
      status: status.targetBtcPriceUsd.status,
      detailFormatted: `Target: ${
        status.targetBtcPriceUsd.target === null
          ? '—'
          : formatCurrency(status.targetBtcPriceUsd.target)
      } · Current: ${
        status.targetBtcPriceUsd.current === null
          ? '—'
          : formatCurrency(status.targetBtcPriceUsd.current)
      }`,
      statusLabel: formatSafetyTargetStatusLabel(
        'targetBtcPriceUsd',
        status.targetBtcPriceUsd,
        'Not available',
      ),
    },
    {
      key: 'safetyBufferPercent',
      label: 'Safety Buffer',
      status: status.safetyBufferPercent.status,
      detailFormatted: `Target: ${
        status.safetyBufferPercent.target === null
          ? '—'
          : formatPercentagePoints(status.safetyBufferPercent.target)
      } · Current: ${
        status.safetyBufferPercent.current === null
          ? '—'
          : formatPercentagePoints(status.safetyBufferPercent.current)
      }${
        status.safetyBufferPercent.status === 'invalid_configuration'
          ? ` · ${SAFETY_BUFFER_INVALID_TARGET_EXPLANATION}`
          : ''
      }`,
      statusLabel: formatSafetyTargetStatusLabel(
        'safetyBufferPercent',
        status.safetyBufferPercent,
        summary.ok ? 'No liquidation risk to compare against' : 'Not available',
      ),
    },
  ];

  return { rows };
}
