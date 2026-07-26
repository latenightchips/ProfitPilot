/**
 * Debt and Interest Panel builder — 06_TASKS.md M5-013. See
 * `../types/debtAndInterestPanel.ts` for the full design reasoning.
 */
import { calculateDebtInterestBreakdown, type PortfolioSummary } from '@/services';
import type { Portfolio } from '@/types/portfolio';

import type { DebtAndInterestPanelData } from '../types/debtAndInterestPanel';
import type { DashboardProtocolFreshness } from '../types/viewModel';
import { formatCurrency, formatPercent } from './format';

/** Matches `stores/portfolioStore.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

export function buildDebtAndInterestPanel(
  portfolio: Portfolio,
  summary: PortfolioSummary,
  protocolFreshness: DashboardProtocolFreshness | null,
): DebtAndInterestPanelData {
  const breakdownResult = calculateDebtInterestBreakdown(portfolio, SOURCE_STATUS);

  return {
    formattedTotalDebt: formatCurrency(summary.debtValue),
    formattedCurrentBorrowRate: formatPercent(portfolio.protocol.borrowApr),
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
