/**
 * Scenario Builder types — 06_TASKS.md M6-004 ("Create Scenario
 * Builder"). Dependencies: M6-003, M3-009. Description: "Implement the
 * Scenario Builder interface." "Users can modify": BTC price, Borrow
 * rate, Collateral, Debt, Target Health Factor, Time horizon (six
 * fields). DoD: "Scenario inputs are validated before calculation."
 *
 * **"Collateral"/"Debt" are each one signed delta field, not two
 * separate add/withdraw or borrow/repay fields.** `03_UI.md`'s own
 * Page 5 ("Simulation Workspace") "SECTION 1 SCENARIO CONTROLS" and
 * `01_PRD.md`'s REQ-004 "SUPPORTED SIMULATIONS" both describe these as
 * directional actions ("Additional Borrow" / "Debt Repayment,"
 * "Increase Collateral" / "Decrease Collateral"), which would be four
 * fields, not the two ("Collateral," "Debt") M6-004's own literal list
 * names. A signed delta (positive = add/borrow more, negative =
 * withdraw/repay) captures both directions of each while keeping this
 * task's own literal 6-field count intact, rather than silently
 * expanding it to 8.
 *
 * **Every field here is validated this batch; only BTC Price is wired
 * to a real calculation.** See `ScenarioBuilder.tsx`'s own header
 * comment for the full reasoning: M6-004's own Dependencies name only
 * M3-009 (`simulateScenario`, price/interest scenarios), and the other
 * five fields belong to their own later, dedicated tasks (Borrow rate →
 * M6-006; Collateral/Debt deltas → M6-008; Time horizon → M6-007;
 * Target Health Factor → no later task names it as an input anywhere,
 * a genuine specification gap, not silently invented here) whose own
 * DoDs are specifically about wiring their own Service outputs. Wiring
 * them here would be pre-empting those tasks' own scope, not
 * fulfilling M6-004's — whose own DoD is literally just "inputs are
 * validated before calculation," not "every input calculates."
 */
export type HoldingPeriod = '30' | '90' | '180' | '365' | 'custom';

export interface ScenarioBuilderFormValues {
  btcPriceUsd: string;
  borrowApr: string;
  collateralDelta: string;
  debtDelta: string;
  targetHealthFactor: string;
  holdingPeriod: HoldingPeriod;
  customHoldingPeriodDays: string;
}

export interface ScenarioBuilderFieldErrors {
  btcPriceUsd: string | null;
  borrowApr: string | null;
  collateralDelta: string | null;
  debtDelta: string | null;
  targetHealthFactor: string | null;
  customHoldingPeriodDays: string | null;
}
