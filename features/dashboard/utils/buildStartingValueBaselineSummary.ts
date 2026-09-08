/**
 * Starting-Value Baseline Summary builder — v1.20.0 Batch 1 (Dashboard
 * Starting-Value Baseline Visibility). See
 * `../types/startingValueBaselineSummary.ts` for the full design
 * reasoning.
 *
 * **Derives no financial value of its own.** Calls
 * `calculateStartingValueBaselineComparison` (`services/portfolio/startingValueBaseline.ts`,
 * v1.17.0 Batch 1) — the same authoritative function
 * `app/portfolio/StartingValueBaselinePanel.tsx` already calls — and
 * only formats its already-computed `baselineValueUsd`/`currentValueUsd`/
 * `absoluteChangeUsd`/`percentageChange`/`establishedAt`/`status` fields
 * for direct render, the same "builder formats, component only renders
 * strings" division of labor `buildLeverageSummary.ts` already
 * establishes. No arithmetic (addition, subtraction, division, or
 * comparison of the underlying numbers) happens in this file — every
 * numeric relationship is already resolved by the Service call above.
 *
 * `formatSignedCurrency`/`formatSignedPercent` are the same sign
 * convention `StartingValueBaselinePanel.tsx` already defines locally on
 * the Portfolio page (a positive change always shows an explicit "+";
 * `Intl.NumberFormat` already renders a negative sign on its own) —
 * restated here, not imported, matching this codebase's own established
 * "each page/feature owns its formatting layer" convention
 * (`features/dashboard/utils/format.ts`'s own header comment).
 */
import { calculateStartingValueBaselineComparison } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type { StartingValueBaselineSummary } from '../types/startingValueBaselineSummary';
import { formatCurrency, formatDateTime, formatPercent } from './format';

function formatSignedCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatCurrency(value)}`;
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatPercent(value)}`;
}

export function buildStartingValueBaselineSummary(
  portfolio: Portfolio,
): StartingValueBaselineSummary {
  const comparison = calculateStartingValueBaselineComparison(portfolio);

  if (comparison === null) {
    return {
      hasBaseline: false,
      establishedAtFormatted: null,
      baselineValueFormatted: null,
      currentValueFormatted: null,
      changeFormatted: null,
      compositionChanged: false,
    };
  }

  const changeFormatted = `${formatSignedCurrency(comparison.absoluteChangeUsd)} (${
    comparison.percentageChange === null ? '—' : formatSignedPercent(comparison.percentageChange)
  })`;

  return {
    hasBaseline: true,
    establishedAtFormatted: formatDateTime(comparison.establishedAt),
    baselineValueFormatted: formatCurrency(comparison.baselineValueUsd),
    currentValueFormatted: formatCurrency(comparison.currentValueUsd),
    changeFormatted,
    compositionChanged: comparison.status === 'compositionChanged',
  };
}
