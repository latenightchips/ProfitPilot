/**
 * Debt and Interest Panel types — 06_TASKS.md M5-013 ("Implement Debt
 * and Interest Panel"). Dependencies: M5-003. DoD: "The user can
 * understand the ongoing cost of maintaining the position."
 *
 * **"Projected debt where available" — not built.** Any real debt
 * projection over time requires compound interest, and Conflict #7
 * (compound interest, M2-013/M2-014) already documents that no formula
 * exists anywhere in the specification for it — a pre-existing,
 * already-approved blocker, not a new one raised here.
 *
 * **Monthly/Daily interest cost** come from the new
 * `calculateDebtInterestBreakdown` Service (`services/portfolio/interestBreakdown.ts`,
 * added this batch) — real Engine formulas F-030/F-031, not a division
 * of the already-known annual figure (see that Service's own header
 * comment for why the two are not interchangeable).
 */
export interface DebtAndInterestPanelData {
  formattedTotalDebt: string;
  formattedCurrentBorrowRate: string;
  formattedAnnualInterestCost: string;
  /** '—' only in the practically-unreachable case where the new interest-breakdown Service call fails on an already-successful summary. */
  formattedMonthlyInterestCost: string;
  formattedDailyInterestCost: string;
  /** From `DashboardProtocolFreshness.origin` — 'manual' in this version (M4-014/M4-015). `null` only in the practically-unreachable case where protocol freshness lookup itself fails. */
  rateSource: string | null;
}
