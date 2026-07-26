/**
 * Leverage Summary types — 06_TASKS.md M5-014 ("Implement Leverage
 * Summary Section"). Dependencies: M5-003. DoD: "The section explains
 * leverage without requiring advanced financial knowledge."
 *
 * **"Debt-to-equity ratio" — not built.** This is not a new gap: M2-008
 * ("Implement Leverage Calculations"), the Engine-layer task this
 * Dashboard section's Include list mirrors almost exactly, already
 * skipped this same sub-item for the same reason — "no Formula ID in
 * `02_Formulas.md`, would mean inventing a formula" (see
 * PROJECT_STATUS.md's Milestone 2 Batch 2 write-up). Carried forward
 * unchanged rather than re-litigated at the Dashboard layer.
 *
 * **"Gross exposure" and "Effective BTC exposure" render the identical
 * value** — `PortfolioSummary.collateralValue`. Not a display bug:
 * `engine/portfolio/calculateExposure.ts` (F-010, "Gross exposure")
 * documents itself as numerically identical to Collateral Value (F-002)
 * under Version 1's single-collateral-asset scope, and its own comment
 * states it "also serves 06_TASKS.md M2-008's 'Effective BTC exposure'
 * ... no separate calculation exists for it" — an already-approved
 * Milestone 2 interpretation, reused here rather than reinterpreted.
 */
export interface LeverageSummary {
  formattedGrossExposure: string;
  formattedNetEquity: string;
  formattedLeverageRatio: string;
  /** Identical to `formattedGrossExposure` — see this file's own header comment. */
  formattedEffectiveBtcExposure: string;
  explanation: string;
}
