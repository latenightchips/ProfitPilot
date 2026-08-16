/**
 * Debt and Interest Panel builder — 06_TASKS.md M5-013. See
 * `../types/debtAndInterestPanel.ts` for the full design reasoning.
 */
import {
  calculateDebtInterestBreakdown,
  deriveAaveV4EffectiveBorrowRate,
  type PortfolioSummary,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type { DebtAndInterestPanelData } from '../types/debtAndInterestPanel';
import type { DashboardProtocolFreshness } from '../types/viewModel';
import { formatCurrency, formatPercent } from './format';

/** Matches `stores/portfolioStore.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

/**
 * "Current Borrow Rate" — V4 Readiness Audit §12 Stage 15. Previously
 * `formatPercent(portfolio.protocol.borrowApr)` unconditionally, which for
 * a V4 portfolio showed a legacy V3 scalar mathematically unrelated to the
 * `formattedAnnualInterestCost` figure right next to it (that figure was
 * already correctly V4-aware since Stage 9/11). Now derives the real
 * effective rate from synced `v4DebtState` for V4 — `'—'` (never a
 * fabricated or stale V3 number) when that state is absent, invalid, or
 * the derivation itself fails.
 */
function formatBorrowRate(
  portfolio: Portfolio,
  tracked: { engineVersion: string; formulaVersion: string },
): string {
  if (portfolio.protocolVersion !== 'v4') {
    return formatPercent(portfolio.protocol.borrowApr);
  }
  if (portfolio.v4DebtState === undefined) return '—';
  const rateStep = deriveAaveV4EffectiveBorrowRate(portfolio.v4DebtState, tracked, SOURCE_STATUS);
  return rateStep.ok ? formatPercent(rateStep.value) : '—';
}

export function buildDebtAndInterestPanel(
  portfolio: Portfolio,
  summary: PortfolioSummary,
  protocolFreshness: DashboardProtocolFreshness | null,
  tracked: { engineVersion: string; formulaVersion: string },
): DebtAndInterestPanelData {
  const breakdownResult = calculateDebtInterestBreakdown(portfolio, SOURCE_STATUS);

  return {
    formattedTotalDebt: formatCurrency(summary.debtValue),
    formattedCurrentBorrowRate: formatBorrowRate(portfolio, tracked),
    formattedAnnualInterestCost: formatCurrency(summary.interestCost),
    formattedMonthlyInterestCost: breakdownResult.ok
      ? formatCurrency(breakdownResult.data.monthly)
      : '—',
    formattedDailyInterestCost: breakdownResult.ok
      ? formatCurrency(breakdownResult.data.daily)
      : '—',
    rateSource: protocolFreshness !== null ? protocolFreshness.origin : null,
  };
}
