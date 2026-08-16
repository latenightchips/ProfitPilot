/**
 * Loop Strategy Service — 06_TASKS.md M3-010 ("Implement Loop Strategy
 * Service"): "Coordinate Loop Builder calculations." Responsibilities:
 * validate strategy settings, load protocol parameters, apply cost
 * assumptions, call loop calculation modules, return step-by-step
 * outputs, surface safety warnings. DoD: "The Loop Builder can request
 * one complete strategy result from the Service."
 *
 * **Revisiting conflict #8 (swap fees/slippage/gas estimate gap) —
 * resolved by faithful pass-through, not by inventing a cost model.**
 * `06_TASKS.md`'s "Apply cost assumptions" reads as though it requires a
 * complete cost model, which does not exist anywhere in `02_Formulas.md`
 * — but the Engine layer already resolved this at M2-017
 * (`calculateLoopCosts`): it computes what is documented (Borrowing
 * Interest F-032, Break-Even BTC Appreciation F-037) and itemizes what
 * is not (`swapFees`/`slippage`/`gasEstimate`/`totalImplementationCost`,
 * each with a reason) rather than fabricating a fee/slippage/gas model.
 * This Service calls `calculateLoopCosts` as-is and passes the
 * `unavailable` array straight through — "apply cost assumptions" is
 * satisfied for what is documented; conflict #8 remains open at the
 * specification level (no new formula was authored), but does not block
 * this task, the same way conflict #9 did not block M3-012.
 *
 * **"Validate strategy settings" and "surface safety warnings" reuse
 * `validateLoopStrategySafety` (M2-018) directly** — it already performs
 * every documented safety check (protocol parameter validity,
 * liquidation proximity, minimum Health Factor floor, borrowing
 * capacity, resulting LTV, loop count) and returns `viable`/`findings`
 * exactly matching this Responsibility. No separate validation layer is
 * added on top.
 *
 * **"Load protocol parameters"**: no Protocol Parameter Service (M3-008)
 * exists yet to load from. `protocol` comes from the portfolio's own
 * `ProtocolParameters` field (already part of `ApplicationPortfolio`,
 * M3-004) — the caller supplies it, the same "accept what the Service
 * doesn't own as a parameter" principle as `sourceStatus` (M3-005) and
 * `RecommendationRuleConfig` (M3-012). When M3-008 exists, its output
 * naturally becomes the source of this same field; nothing here needs
 * to change.
 *
 * **`maxLoanToValueOverride`/`borrowAprOverride` — added Milestone 7
 * Batch 2 (M7-008, "Implement Loop Strategy Controls").** Both are
 * optional caller-supplied substitutes for the portfolio's own
 * `protocol.maxLoanToValue`/`protocol.borrowApr`, applied to a locally
 * constructed `ProtocolParameters` object before either the safety
 * validation or the cost calculation runs — zero Engine changes, the
 * same "Service constructs a modified input value" pattern
 * `simulateInterestScenario`'s own caller-supplied `borrowApr`
 * parameter (M2-020/M6-006) already established. When omitted, the
 * portfolio's own real values are used unchanged.
 *
 * **`btcExposure` — added Milestone 7 Batch 2 (M7-011, "Implement Loop
 * Strategy Summary").** The final-state BTC exposure (`calculateExposure`,
 * F-010) was already being computed internally to feed `calculateLoopCosts`
 * but discarded; it is now surfaced on `LoopStrategyPreview` — the same
 * "surface an already-computed internal value" pattern
 * `simulationStore.ts`'s own `warnings`/`lastMetadata` additions already
 * established. Null alongside `strategy`/`costs` when the strategy is
 * not viable.
 *
 * **`remainingBorrowCapacity`/`monthlyInterestCost` — added Milestone 7
 * Batch 3 (M7-013 "Implement Loop Safety Analysis" / M7-014 "Implement
 * Loop Cost Analysis").** Both reuse already-public Engine functions —
 * zero new Formula Engine logic. `remainingBorrowCapacity` calls
 * `calculateAvailableBorrow` (F-013) against the final position, reusing
 * `exposureStep.value` as its own `collateralValue` input rather than
 * calling `calculateCollateralValue` a second time: `calculateExposure`'s
 * own header comment states Exposure (F-010) is numerically identical to
 * Collateral Value (F-002) under this codebase's single-collateral-asset
 * scope ("Exposure equals Collateral Value... reused rather than
 * recomputed") — the exact same identity, one layer further. Passing the
 * override-resolved `engineInput.protocol.maxLoanToValue`/`finalDebt`
 * means "remaining capacity" reflects the same effective protocol
 * parameters the safety check and cost calculation already used, not the
 * portfolio's own un-overridden values. `monthlyInterestCost` calls
 * `calculateMonthlyInterest` (F-031) against the same `finalDebt`/
 * `engineInput.protocol.borrowApr` pair `calculateLoopCosts` already uses
 * for `borrowingInterest` (F-032, Annual) — the same non-simple-division
 * day-count convention `services/portfolio/interestBreakdown.ts` (M5-013)
 * already established (`Monthly ≠ Annual / 12`), reused rather than
 * approximated. Both null alongside `strategy`/`costs` when the strategy
 * is not viable, the same convention every other post-safety-gate field
 * already follows.
 */
import {
  calculateAvailableBorrow,
  calculateExposure,
  calculateLoopCosts,
  calculateMonthlyInterest,
  type LoopCostResult,
  type LoopSafetyFinding,
  type LoopStrategyResult,
  type ProtocolParameters,
  validateLoopStrategySafety,
} from '@/engine';

import {
  checkAaveV4DebtStateAvailable,
  mapApplicationPortfolioToEngineInput,
} from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';
import { formulaStep, optionsFromTracked, type TrackedFormulaVersion } from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult, type ServiceWarning } from '../shared/result';

export interface LoopStrategySettings {
  targetBorrowPercentage: number;
  maxLoops: number;
  minHealthFactor: number;
  /** Overrides the portfolio's own `protocol.maxLoanToValue` for this calculation only, when supplied. */
  maxLoanToValueOverride?: number;
  /** Overrides the portfolio's own `protocol.borrowApr` for this calculation only, when supplied. */
  borrowAprOverride?: number;
}

export interface LoopStrategyPreview {
  viable: boolean;
  findings: LoopSafetyFinding[];
  /** null when the strategy is not viable (see `findings` for why). */
  strategy: LoopStrategyResult | null;
  /** null alongside `strategy` — no final position exists to cost. */
  costs: LoopCostResult | null;
  /** Final BTC exposure (F-010). Null alongside `strategy`/`costs`. */
  btcExposure: number | null;
  /** Remaining borrow capacity (F-013) on the final position. Null alongside `strategy`/`costs`. */
  remainingBorrowCapacity: number | null;
  /** Monthly interest cost (F-031) on the final debt. Null alongside `strategy`/`costs`. */
  monthlyInterestCost: number | null;
}

/**
 * Plans and safety-checks a Loop strategy in one call — 06_TASKS.md
 * M3-010. `sourceStatus` is caller-supplied for the same reason as
 * `calculatePortfolioSummary` (M3-005).
 */
export function planLoopStrategy(
  portfolio: ApplicationPortfolio,
  settings: LoopStrategySettings,
  sourceStatus: string,
): ServiceResult<LoopStrategyPreview> {
  const mappedInput = mapApplicationPortfolioToEngineInput(portfolio);
  const protocol: ProtocolParameters = {
    ...mappedInput.protocol,
    ...(settings.maxLoanToValueOverride !== undefined && {
      maxLoanToValue: settings.maxLoanToValueOverride,
    }),
    ...(settings.borrowAprOverride !== undefined && { borrowApr: settings.borrowAprOverride }),
  };
  const engineInput = { ...mappedInput, protocol };
  const { targetBorrowPercentage, maxLoops, minHealthFactor } = settings;
  const warnings: ServiceWarning[] = [];

  const safetyStep = formulaStep(
    validateLoopStrategySafety({
      ...engineInput,
      targetBorrowPercentage,
      maxLoops,
      minHealthFactor,
    }),
    null,
    sourceStatus,
  );
  if (!safetyStep.ok) return safetyStep.failure;
  let tracked: TrackedFormulaVersion = safetyStep.tracked;
  warnings.push(...safetyStep.warnings);
  const safety = safetyStep.value;

  // V4 Readiness Audit §12 Stage 10 — this Service reads debt (via
  // `mappedInput`/`engineInput` above) and `protocol.borrowApr` throughout
  // (`calculateLoopCosts`, `calculateMonthlyInterest`), so a V4 portfolio
  // with no synced `v4DebtState` must fail closed here rather than
  // silently planning a loop strategy against stale legacy `debt.balance`.
  // See `services/portfolio/mapping.ts`'s `checkAaveV4DebtStateAvailable`.
  const v4GuardFailure = checkAaveV4DebtStateAvailable(portfolio, tracked, sourceStatus);
  if (v4GuardFailure !== null) return v4GuardFailure;

  if (safety.strategy === null) {
    return createServiceSuccess(
      {
        viable: safety.viable,
        findings: safety.findings,
        strategy: null,
        costs: null,
        btcExposure: null,
        remainingBorrowCapacity: null,
        monthlyInterestCost: null,
      },
      optionsFromTracked(sourceStatus, tracked),
      warnings,
    );
  }

  const exposureStep = formulaStep(
    calculateExposure(safety.strategy.finalCollateral, engineInput.market),
    tracked,
    sourceStatus,
  );
  if (!exposureStep.ok) return exposureStep.failure;
  tracked = exposureStep.tracked;
  warnings.push(...exposureStep.warnings);

  const costsStep = formulaStep(
    calculateLoopCosts(
      safety.strategy.finalDebt,
      engineInput.protocol.borrowApr,
      exposureStep.value,
    ),
    tracked,
    sourceStatus,
  );
  if (!costsStep.ok) return costsStep.failure;
  tracked = costsStep.tracked;
  warnings.push(...costsStep.warnings);

  const capacityStep = formulaStep(
    calculateAvailableBorrow(
      exposureStep.value,
      engineInput.protocol.maxLoanToValue,
      safety.strategy.finalDebt,
    ),
    tracked,
    sourceStatus,
  );
  if (!capacityStep.ok) return capacityStep.failure;
  tracked = capacityStep.tracked;
  warnings.push(...capacityStep.warnings);

  const monthlyInterestStep = formulaStep(
    calculateMonthlyInterest(safety.strategy.finalDebt, engineInput.protocol.borrowApr),
    tracked,
    sourceStatus,
  );
  if (!monthlyInterestStep.ok) return monthlyInterestStep.failure;
  tracked = monthlyInterestStep.tracked;
  warnings.push(...monthlyInterestStep.warnings);

  return createServiceSuccess(
    {
      viable: safety.viable,
      findings: safety.findings,
      strategy: safety.strategy,
      costs: costsStep.value,
      btcExposure: exposureStep.value,
      remainingBorrowCapacity: capacityStep.value,
      monthlyInterestCost: monthlyInterestStep.value,
    },
    optionsFromTracked(sourceStatus, tracked),
    warnings,
  );
}
