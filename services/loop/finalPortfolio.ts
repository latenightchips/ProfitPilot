import type { LoopStrategyResult } from '@/engine';

import { resolveCanonicalDebtBalance } from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';

/**
 * Builds the plain `ApplicationPortfolio` representing a Loop strategy's
 * own final state — extracted at Milestone 7 Batch 3 from
 * `LoopStrategySummary.tsx` (Batch 2), which was the first of now three
 * consumers (`LoopStrategySummary.tsx`, `LoopSafetyAnalysis.tsx` M7-013,
 * `stores/loopBuilderStore.ts`'s own `runSensitivityScenario` M7-015).
 * Pure object construction, not a calculation — `market`/`protocol` are
 * carried over unchanged from the starting portfolio (a loop changes
 * collateral/debt, never market price or protocol parameters), so no
 * value here is derived a second way; every consumer still reaches its
 * own numbers by passing this through `calculatePortfolioSummary`
 * (M3-005) or `simulateScenario` (M3-009), never by reading a field off
 * this object directly as a result.
 *
 * **`protocolVersion`/`v4Position`/`v4DebtState` now carried through for a
 * V4 portfolio — V4 Readiness Audit §12 Stage 17 (Part 3), a genuine
 * defect found while implementing that stage, not a pre-existing,
 * deliberate scope boundary.** Before this fix, this function returned a
 * plain V3-shaped `ApplicationPortfolio` (no `protocolVersion` at all)
 * for *every* caller, including a V4 starting portfolio — verified
 * empirically: with a V4 `finalPortfolio`, `simulateScenario` (and
 * `calculatePortfolioSummary`) branch on `protocolVersion`, so a genuine
 * V4 portfolio's own final state was silently evaluated as V3 throughout
 * `LoopScenarioSensitivity.tsx`/`LoopSafetyAnalysis.tsx`/
 * `LoopStrategySummary.tsx` — reading the starting portfolio's leftover
 * `protocol.borrowApr`/`debt.balance` fields as if they were authoritative,
 * exactly the class of bug the rest of this codebase's V4 canonical
 * boundaries (`resolveCanonicalDebtBalance`, `deriveAaveV4EffectiveBorrowRate`)
 * were built to close. This was the actual reason `scenario.v4RateStress`
 * would have had zero effect no matter what `LoopScenarioSensitivity.tsx`
 * set it to: `simulateScenario`'s V4 branch was simply never reached.
 *
 * `strategy.finalDebt` is Engine-computed purely as scalar borrow
 * arithmetic (`engine/loop/calculateLoopStrategy.ts`'s own `currentDebt`,
 * seeded from `mapApplicationPortfolioToEngineInput`'s already-priced
 * `debt.balance` and incremented once per step's `borrowedAmount` — no
 * protocol-version branching, no interest accrual inside the loop
 * itself). It is therefore a USD figure, not a raw token quantity.
 * Ignored (base V3-shaped object only) for a `'v3'`/unset portfolio, or a
 * `'v4'` portfolio with no synced `v4DebtState` — unreachable via
 * `strategy` being non-null, since `planLoopStrategy`'s own fail-closed
 * guard requires `v4DebtState` before it ever produces one.
 *
 * **USD vs. raw quantity (V4 Readiness Audit §12 P1-D3, a genuine defect
 * found while implementing that stage).** Before this fix,
 * `loopIntroducesAmbiguousV4Borrow` compared `strategy.finalDebt` (USD)
 * directly against `v4DebtState.drawnDebt + v4DebtState.premiumDebt` (raw
 * token quantity) and, when not ambiguous, used the same mismatched
 * subtraction to derive a "newly borrowed" quantity added to `drawnDebt`.
 * This was only ever safe under the old implicit-$1-per-debt-token
 * assumption P1-D3 removed — for a live V4 portfolio with a real oracle
 * price, comparing/subtracting USD against raw quantity silently
 * corrupted the loop-final `v4DebtState` even when zero loop steps
 * actually committed (e.g. `maxLoops: 0`, or an immediate
 * `NO_AVAILABLE_BORROW`). Both functions below now compare in USD via
 * `resolveCanonicalDebtBalance` — the same canonical chokepoint the
 * Engine input itself was priced through — never the raw sum directly.
 *
 * **BLOCKER #3 fix — a real new borrow no longer carries the pre-borrow
 * `riskPremium` forward as though it were exact.** Before this fix, any
 * `newlyBorrowed > 0` still set `riskPremium: portfolio.v4DebtState.riskPremium`
 * unchanged, presenting the resulting Health Factor/liquidation figures
 * as exact throughout Loop Builder and Apply Loop as Simulation. This
 * directly contradicted this codebase's own protocol-audited doctrine,
 * documented at `services/portfolio/mapping.ts`'s `deriveV4DebtStateAfterDelta`
 * (Stage 12): Aave V4's `Spoke.sol.borrow()` calls `_notifyRiskPremiumUpdate`,
 * driven by a fresh Risk Premium recomputation over the user's ENTIRE
 * multi-collateral set — data this codebase's single-BTC domain model has
 * never captured — so "a post-borrow `riskPremium`... is not knowable
 * from this codebase's persisted state alone, so it is not guessed. This
 * is hierarchy option D: keep it fail-closed... not a lower-confidence
 * shortcut." A loop strategy IS a sequence of borrows — exactly the
 * triggering action that doctrine already covers for the generic
 * position-change path (`deriveV4DebtStateAfterDelta` returns
 * `value: undefined` for any `debtDelta > 0`) — so this function now
 * applies the identical rule: `loopIntroducesAmbiguousV4Borrow` below
 * detects it, and this function omits `v4DebtState` entirely (mirroring
 * `deriveV4DebtStateAfterDelta`'s own `undefined` signal) rather than
 * guessing. Every downstream `calculatePortfolioSummary`/`planLoopStrategy`/
 * `simulatePortfolioTransition` call already fails closed on a missing
 * `v4DebtState` via the existing `checkAaveV4DebtStateAvailable` guard —
 * this is defense in depth; each of the four UI consumers
 * (`LoopStrategySummary.tsx`, `LoopSafetyAnalysis.tsx`,
 * `stores/loopBuilderStore.ts`'s `runSensitivityScenario`,
 * `ApplyLoopAsSimulation.tsx`) also calls `loopIntroducesAmbiguousV4Borrow`
 * proactively, so the user sees this file's own
 * `V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE` — not the generic,
 * wrong-context "sync a live position or enter it manually" guard text,
 * which would misleadingly imply the STARTING portfolio's own data is
 * what's missing, when it is specifically the POST-borrow state that
 * cannot be derived.
 *
 * **A zero-loop (or otherwise no-op) result is unaffected.** When
 * `loopIntroducesAmbiguousV4Borrow` is false, the strategy made no loops
 * (e.g. immediately blocked by a safety limit) — `calculateLoopStrategy`'s
 * `currentDebt` only ever increases per committed step and starts at the
 * Engine's own already-priced `debt.balance`, so a non-ambiguous result
 * means `strategy.finalDebt` is EXACTLY the starting USD balance, not
 * merely close to it. No borrow actually happened, so the starting
 * `v4DebtState` — quantity, rates, AND `debtAssetPriceUsd` alike — is
 * carried through byte-identical, the same reasoning
 * `deriveV4DebtStateAfterDelta` already applies for `debtDelta === 0`.
 *
 * **`v4CollateralRisk`/`v4Position` are unaffected by this fix** — Stage
 * 23D's own reasoning (below) already established a loop borrows against
 * the same collateral-risk config; that is a separate on-chain fact from
 * the risk-premium refresh and remains correct regardless of whether a
 * borrow occurred.
 */
export const V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE =
  'This strategy adds new Aave V4 borrowing, which triggers an on-chain Risk Premium refresh whose new value cannot be computed from currently available data — Health Factor, LTV, and liquidation figures for the resulting position are not shown. Loop count, BTC purchased, total debt, and estimated interest cost (based on the current rate) remain accurate.';

/**
 * Detects the one case `buildFinalLoopPortfolio` cannot resolve exactly
 * — see this file's own header comment (BLOCKER #3 fix) for the full
 * protocol-audited reasoning. Exported so every UI consumer can check
 * this same condition proactively, before ever calling
 * `buildFinalLoopPortfolio`, and show `V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN_MESSAGE`
 * directly rather than surfacing a generic downstream Service failure.
 */
export function loopIntroducesAmbiguousV4Borrow(
  portfolio: ApplicationPortfolio,
  strategy: LoopStrategyResult,
): boolean {
  if (portfolio.protocolVersion !== 'v4' || portfolio.v4DebtState === undefined) {
    return false;
  }
  // V4 Readiness Audit §12 P1-D3 — compare in USD (via the same canonical
  // chokepoint `strategy.finalDebt` was itself priced through), never the
  // raw `drawnDebt + premiumDebt` sum directly. See this file's own
  // header comment.
  const startingCanonicalDebtUsd = resolveCanonicalDebtBalance(portfolio);
  return strategy.finalDebt - startingCanonicalDebtUsd > 0;
}

export function buildFinalLoopPortfolio(
  portfolio: ApplicationPortfolio,
  strategy: LoopStrategyResult,
): ApplicationPortfolio {
  const finalPortfolio: ApplicationPortfolio = {
    collateral: strategy.finalCollateral,
    debt: { asset: portfolio.debt.asset, balance: strategy.finalDebt },
    market: portfolio.market,
    protocol: portfolio.protocol,
  };

  if (portfolio.protocolVersion !== 'v4' || portfolio.v4DebtState === undefined) {
    return finalPortfolio;
  }

  const withV4Identity: ApplicationPortfolio = {
    ...finalPortfolio,
    protocolVersion: portfolio.protocolVersion,
    v4Position: portfolio.v4Position,
    // V4 Readiness Audit §12 Stage 23D — a loop strategy changes debt via
    // additional borrowing against the SAME already-configured collateral
    // reserve, never the collateral-risk config itself (Stage 23B:
    // collateralFactor is bound to the reserve's dynamic-config snapshot,
    // not touched by borrow), so this carries the real synced value
    // forward unchanged, the same rule `v4Position` above already
    // follows. Without this, the calculatePortfolioSummary call this
    // final portfolio eventually reaches would fail closed on
    // AAVE_V4_COLLATERAL_RISK_MISSING even when the starting portfolio's
    // collateral risk was fully synced.
    v4CollateralRisk: portfolio.v4CollateralRisk,
  };

  // BLOCKER #3 fix — a real new borrow's post-borrow riskPremium is not
  // knowable; omit `v4DebtState` entirely rather than guess. See this
  // file's own header comment.
  if (loopIntroducesAmbiguousV4Borrow(portfolio, strategy)) {
    return withV4Identity;
  }

  // V4 Readiness Audit §12 P1-D3 — `loopIntroducesAmbiguousV4Borrow` above
  // already proved, via the USD-consistent comparison, that no step
  // committed a real borrow: a non-ambiguous result means
  // `strategy.finalDebt` is exactly the starting USD balance. Nothing
  // about quantity, rates, or the authoritative price changed, so the
  // starting `v4DebtState` is carried through unchanged — no
  // reconstruction, no unit conversion, no risk of the raw-quantity/USD
  // mismatch that previously corrupted this branch (see header comment).
  return {
    ...withV4Identity,
    v4DebtState: portfolio.v4DebtState,
  };
}
