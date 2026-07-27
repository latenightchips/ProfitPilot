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

/**
 * **`percentageChange` (M6-005, Batch 4)**: a fraction, matching
 * `engine/simulation/resolveScenarioPrice.ts`'s (F-051) own
 * `New Price = Current Price × (1 + Change%)` — `0.10` for +10%, `-0.20`
 * for -20% — the same 0–1 fraction convention every other rate field in
 * this codebase already uses (`borrowApr`, `maxLoanToValue`, etc.), not
 * an invented percent-out-of-100 unit.
 */
export interface ScenarioBuilderFormValues {
  btcPriceUsd: string;
  percentageChange: string;
  borrowApr: string;
  collateralDelta: string;
  debtDelta: string;
  targetHealthFactor: string;
  holdingPeriod: HoldingPeriod;
  customHoldingPeriodDays: string;
}

export interface ScenarioBuilderFieldErrors {
  btcPriceUsd: string | null;
  percentageChange: string | null;
  borrowApr: string | null;
  collateralDelta: string | null;
  debtDelta: string | null;
  targetHealthFactor: string | null;
  customHoldingPeriodDays: string | null;
}

/**
 * Preset BTC Price scenarios — 06_TASKS.md M6-005 ("Implement Price
 * Scenario Simulation"), "Support: ... Preset scenarios ...".
 *
 * **8 presets, not `03_UI.md` Page 5's own 7** — that page's own
 * "PRESET SCENARIOS" mockup lists "+10%, +25%, +50%, +100%, -10%, -20%,
 * -30%, Reset" (7 quick buttons, plus Reset). `01_PRD.md`'s REQ-004-A
 * ("BTC PRICE SIMULATION") own "Required Presets" list is fuller:
 * "+10%, +25%, +50%, +100%, -10%, -20%, -30%, -50%, Custom Price" (8,
 * plus Custom). Resolved in favor of the PRD's own list — it is
 * explicitly labeled "Required," a stronger claim than a page mockup's
 * own example quick-button row — rather than silently dropping the
 * `-50%` preset neither list agrees on. "Reset" is not duplicated as
 * its own preset button here — `ScenarioBuilder`'s own existing "Reset
 * Scenario" button (M6-004) already does exactly this.
 */
export const PRICE_PRESETS: number[] = [0.1, 0.25, 0.5, 1.0, -0.1, -0.2, -0.3, -0.5];
