/**
 * Loop Strategy Service — 06_TASKS.md M3-010 ("Implement Loop Strategy
 * Service"): "Coordinate Loop Builder calculations." Responsibilities:
 * validate strategy settings, load protocol parameters, apply cost
 * assumptions, call loop calculation modules, return step-by-step
 * outputs, surface safety warnings. DoD: "The Loop Builder can request
 * one complete strategy result from the Service."
 *
 * **Revisiting conflict #8 (swap fees/slippage/gas estimate gap) —
 * resolved for real, V4 Readiness Audit §12 P1-6.** `06_TASKS.md`'s
 * "Apply cost assumptions" originally had no cost model to apply against
 * (`02_Formulas.md` had no Formula ID for any of the three); F-070–F-073
 * (P1-5) closed that gap, and this Service now resolves the active
 * portfolio's own `settings.executionCostAssumptions` (the caller
 * supplies it — see `planLoopStrategy`'s own `executionCostAssumptions`
 * parameter doc, since `ApplicationPortfolio` carries no `settings`) and
 * feeds it into `calculateLoopCosts` (M2-017) as real, product-chosen
 * `totalBorrowedUsd`/`transactionCount` figures. `swapFees`/`slippage`/
 * `gasEstimate`/`totalImplementationCost` are each computed for real once
 * their own required assumption is configured, and remain explicitly
 * itemized as unavailable otherwise — never a fabricated cost model, and
 * never silently dropped either way.
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
  calculateCollateralValue,
  calculateExposure,
  calculateLoopCosts,
  calculateMonthlyInterest,
  type LoopCostResult,
  type LoopExecutionCostInputs,
  type LoopSafetyFinding,
  type LoopStrategyResult,
  type ProtocolParameters,
  validateLoopStrategySafety,
} from '@/engine';
import type { ExecutionCostAssumptionsSettings } from '@/types/portfolio';

import {
  checkAaveV4CollateralRiskAvailable,
  checkAaveV4DebtAssetPriceAvailable,
  checkAaveV4DebtStateAvailable,
  deriveAaveV4EffectiveBorrowRate,
  mapApplicationPortfolioToEngineInput,
  resolveRiskCapacityFraction,
} from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';
import { resolveExecutionCostAssumptions } from '../shared/executionCost';
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
  /**
   * The active portfolio's own `settings.executionCostAssumptions` (V4
   * Readiness Audit §12 P1-6) — portfolio-level, not part of
   * `LoopStrategySettings` above, since Loop Builder has no per-strategy
   * override for these three fields (see this stage's own ownership
   * report). `ApplicationPortfolio` itself carries no `settings` field
   * (identity/display-layer only — `services/portfolio/models.ts`), so
   * the caller (`stores/loopBuilderStore.ts`, which holds the full
   * `Portfolio`) supplies it explicitly, the same "caller supplies what
   * the Service doesn't own" convention `sourceStatus`/
   * `maxLoanToValueOverride` already established above.
   */
  executionCostAssumptions?: ExecutionCostAssumptionsSettings,
): ServiceResult<LoopStrategyPreview> {
  const mappedInput = mapApplicationPortfolioToEngineInput(portfolio);
  const { targetBorrowPercentage, maxLoops, minHealthFactor } = settings;
  const warnings: ServiceWarning[] = [];

  // V4 Readiness Audit §12 Stage 23E — a leading, protocol/risk-
  // independent Engine call (never reads debt or protocol), purely to
  // obtain real Engine metadata before either V4 guard below runs —
  // `ServiceMetadata.engineVersion` must always come from a real Engine
  // call (see `services/portfolio/mapping.ts`'s own
  // `checkAaveV4DebtStateAvailable` doc comment), and `validateLoopStrategySafety`
  // below needs the correctly-dispatched risk-capacity fraction from its
  // very first read, so it cannot safely be that anchor (mirrors
  // `calculatePortfolioSummary`'s own `collateralValueStep` positioning).
  const anchorStep = formulaStep(
    calculateCollateralValue(mappedInput.collateral, mappedInput.market),
    null,
    sourceStatus,
  );
  if (!anchorStep.ok) return anchorStep.failure;
  let tracked: TrackedFormulaVersion = anchorStep.tracked;
  warnings.push(...anchorStep.warnings);

  // V4 Readiness Audit §12 Stage 10 — this Service reads debt (via
  // `mappedInput`/`engineInput` below) and `protocol.borrowApr` throughout
  // (`calculateLoopCosts`, `calculateMonthlyInterest`), so a V4 portfolio
  // with no synced `v4DebtState` must fail closed here rather than
  // silently planning a loop strategy against stale legacy `debt.balance`.
  // See `services/portfolio/mapping.ts`'s `checkAaveV4DebtStateAvailable`.
  // Moved earlier than this guard's original Stage 10 position (previously
  // ran AFTER `validateLoopStrategySafety`, discarding an already-computed
  // result on failure) now that a real `tracked` is available this early
  // via the anchor call above — `ServiceFailure` carries no `warnings`
  // field, so this is not an observable behavior change, only less wasted
  // computation.
  const v4DebtGuardFailure = checkAaveV4DebtStateAvailable(portfolio, tracked, sourceStatus);
  if (v4DebtGuardFailure !== null) return v4DebtGuardFailure;

  // V4 Readiness Audit §12 P1-D3 — same fail-closed discipline as the
  // guard above, now for a 'live'-sourced `v4DebtState` that is missing
  // its authoritative debt-asset oracle price (never fires for manual V4).
  const v4PriceGuardFailure = checkAaveV4DebtAssetPriceAvailable(portfolio, tracked, sourceStatus);
  if (v4PriceGuardFailure !== null) return v4PriceGuardFailure;

  // V4 Readiness Audit §12 Stage 23E — `validateLoopStrategySafety`
  // (via `calculateLoopStrategy`/`calculateLoopStep`, F-014) and the
  // `calculateAvailableBorrow` call below both read
  // `engineInput.protocol.liquidationThreshold`/`.maxLoanToValue`
  // directly, a V3-shaped assumption Stage 23D didn't reach — the
  // entirety of Loop Builder's per-step Health Factor/LTV math was
  // V3-shaped for a V4 portfolio until this fix.
  const v4CollateralRiskGuardFailure = checkAaveV4CollateralRiskAvailable(
    portfolio,
    tracked,
    sourceStatus,
  );
  if (v4CollateralRiskGuardFailure !== null) return v4CollateralRiskGuardFailure;

  // V4 Readiness Audit §12 Stage 23E — V4 has no separate max-LTV/
  // liquidation-threshold split (Stage 23B): `collateralFactor` alone
  // governs both borrow capacity and liquidation eligibility, so both
  // V3-shaped fields are set to the same dispatched value for every
  // downstream Engine call in this file. `maxLoanToValueOverride`, when
  // supplied, still wins — the same "what if this risk-capacity limit
  // were X" planning override `borrowAprOverride` already provides for
  // rate, just applied to both V3-shaped fields together for V4 rather
  // than to `maxLoanToValue` alone. `v4CollateralRiskGuardFailure` above
  // already confirmed `v4CollateralRisk` is present whenever
  // `protocolVersion === 'v4'` reaches this point.
  let maxLoanToValue = mappedInput.protocol.maxLoanToValue;
  let liquidationThreshold = mappedInput.protocol.liquidationThreshold;
  if (portfolio.protocolVersion === 'v4') {
    const riskCapacityFraction = resolveRiskCapacityFraction(portfolio)!;
    const dispatched = settings.maxLoanToValueOverride ?? riskCapacityFraction;
    maxLoanToValue = dispatched;
    liquidationThreshold = dispatched;
  } else if (settings.maxLoanToValueOverride !== undefined) {
    maxLoanToValue = settings.maxLoanToValueOverride;
  }

  const protocol: ProtocolParameters = {
    ...mappedInput.protocol,
    maxLoanToValue,
    liquidationThreshold,
    ...(settings.borrowAprOverride !== undefined && { borrowApr: settings.borrowAprOverride }),
  };
  const engineInput = { ...mappedInput, protocol };

  const safetyStep = formulaStep(
    validateLoopStrategySafety({
      ...engineInput,
      targetBorrowPercentage,
      maxLoops,
      minHealthFactor,
    }),
    tracked,
    sourceStatus,
  );
  if (!safetyStep.ok) return safetyStep.failure;
  tracked = safetyStep.tracked;
  warnings.push(...safetyStep.warnings);
  const safety = safetyStep.value;

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

  // V4 Readiness Audit §12 Stage 15 — `calculateLoopCosts`/
  // `calculateMonthlyInterest` below need a borrow rate.
  // `engineInput.protocol.borrowApr` is either the portfolio's real V3
  // rate or `settings.borrowAprOverride` when the caller explicitly
  // supplied one (an explicit "what if this rate were different" planning
  // override, which still wins here — the same precedence
  // `maxLoanToValueOverride`/`borrowAprOverride` already have over every
  // other portfolio-derived value in this Service). Neither is the real
  // V4 rate for a V4 portfolio. `v4DebtGuardFailure` above already
  // confirmed `v4DebtState` is present whenever `protocolVersion === 'v4'`
  // reaches this point, so deriving from it is always safe here.
  let effectiveBorrowApr = engineInput.protocol.borrowApr;
  if (
    portfolio.protocolVersion === 'v4' &&
    portfolio.v4DebtState !== undefined &&
    settings.borrowAprOverride === undefined
  ) {
    const rateStep = deriveAaveV4EffectiveBorrowRate(portfolio.v4DebtState, tracked, sourceStatus);
    if (!rateStep.ok) return rateStep.failure;
    tracked = rateStep.tracked;
    warnings.push(...rateStep.warnings);
    effectiveBorrowApr = rateStep.value;
  }

  // V4 Readiness Audit §12 P1-6 — `resolvedAssumptions` is `undefined`
  // exactly when the portfolio has no swap-fee/slippage assumption
  // configured at all, in which case `execution` below stays `undefined`
  // too and `calculateLoopCosts` reproduces its pre-P1-6 all-unavailable
  // result byte-for-byte. `totalBorrowedUsd` is the total USD actually
  // borrowed across every committed step (`finalDebt` less the portfolio's
  // own starting debt) — the same notional F-070 already applied friction
  // to inside each step. `transactionCount` is this Service's own explicit
  // product decision for F-072's transaction count: one modeled
  // transaction per committed loop step (borrow + buy + resupply, modeled
  // as a single action) — never derived inside the Engine itself (see
  // `calculateTransactionGasCost`'s own doc comment for why).
  const resolvedAssumptions = resolveExecutionCostAssumptions(executionCostAssumptions);
  const execution: LoopExecutionCostInputs | undefined =
    resolvedAssumptions === undefined && executionCostAssumptions?.gasCostUsd === undefined
      ? undefined
      : {
          totalBorrowedUsd: safety.strategy.finalDebt - engineInput.debt.balance,
          transactionCount: safety.strategy.steps.length,
          assumptions: resolvedAssumptions,
          gasCostPerTransactionUsd: executionCostAssumptions?.gasCostUsd,
        };

  const costsStep = formulaStep(
    calculateLoopCosts(
      safety.strategy.finalDebt,
      effectiveBorrowApr,
      exposureStep.value,
      execution,
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
    calculateMonthlyInterest(safety.strategy.finalDebt, effectiveBorrowApr),
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
