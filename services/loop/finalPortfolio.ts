import type { LoopStrategyResult } from '@/engine';

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
 * seeded from the canonical starting total and incremented once per
 * step's `borrowedAmount` — no protocol-version branching, no interest
 * accrual inside the loop itself). The delta between it and the starting
 * canonical total (`v4DebtState.drawnDebt + v4DebtState.premiumDebt`) is
 * therefore exactly the amount newly borrowed across the strategy's
 * steps — attributed entirely to `drawnDebt`, matching Aave V4's own
 * `borrow()` action (`projectAaveV4Debt.ts`'s own header comment: premium
 * accrues only from time-based interest under the position's risk
 * premium, never from a fresh borrow). `baseDrawnApr`/`riskPremium` are
 * unaffected by borrowing more and carry over unchanged. Ignored (base
 * V3-shaped object only) for a `'v3'`/unset portfolio, or a `'v4'`
 * portfolio with no synced `v4DebtState` — unreachable via `strategy`
 * being non-null, since `planLoopStrategy`'s own fail-closed guard
 * requires `v4DebtState` before it ever produces one.
 */
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

  const startingCanonicalDebt = portfolio.v4DebtState.drawnDebt + portfolio.v4DebtState.premiumDebt;
  const newlyBorrowed = strategy.finalDebt - startingCanonicalDebt;

  return {
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
    v4DebtState: {
      drawnDebt: portfolio.v4DebtState.drawnDebt + newlyBorrowed,
      premiumDebt: portfolio.v4DebtState.premiumDebt,
      baseDrawnApr: portfolio.v4DebtState.baseDrawnApr,
      riskPremium: portfolio.v4DebtState.riskPremium,
    },
  };
}
