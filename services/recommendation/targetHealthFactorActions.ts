/**
 * Target Health Factor Actions — a small Service added in Milestone 5
 * Batch 4 to support M5-007 ("Implement Health Factor Status Component")
 * and M5-009 ("Implement Liquidation Risk Panel"). Both Dashboard tasks
 * ask for a concrete action to restore a portfolio's own configured
 * safety target: "Required action to restore target where available"
 * (M5-007), "Debt repayment required for target safety" / "Collateral
 * addition required for target safety" (M5-009).
 *
 * **Why not `generateRecommendationSet` (M3-012)?** That Service requires
 * a complete `RecommendationRuleConfig` — `borrow.userMinHealthFactor`,
 * `borrow.targetDebtRatio`, `repayment.targetHealthFactor`,
 * `additionalCollateral.targetHealthFactor`, `loop.targetHealthFactor`,
 * `loop.loopBorrowPercentage`, `loop.maxAcceptableAnnualInterestCost` —
 * all as one non-optional object (`engine/recommendation/generateRecommendations.ts`).
 * Only `targetHealthFactor` has a real source on `Portfolio`
 * (`settings.safetyTargets.targetHealthFactor`, M4-001); the other five
 * fields have no portfolio-level source and no documented default value
 * anywhere in the specification — calling that Service from the
 * Dashboard would mean inventing thresholds nothing documents. See
 * PROJECT_STATUS.md conflict #29.
 *
 * This Service instead composes the two already-public Engine functions
 * that need only `{ portfolio, targetHealthFactor }` — nothing else:
 * `calculateRepaymentRecommendation` (F-062) and
 * `calculateAdditionalCollateralRecommendation` (F-063). Both already
 * exist in `@/engine`'s curated public barrel (M2-031); neither was
 * previously wrapped by a Service, since `generateRecommendationSet` only
 * calls them internally as part of its own, larger, four-rule
 * composition. `targetHealthFactor` is entirely caller-supplied (the same
 * "never fabricate what the Service doesn't own" principle as
 * `sourceStatus` elsewhere in this Service layer) — the caller is
 * expected to pass `Portfolio.settings.safetyTargets.targetHealthFactor`
 * and to only call this Service when that field is actually set.
 */
import {
  calculateAdditionalCollateralRecommendation,
  calculateCollateralValue,
  calculateRepaymentRecommendation,
  type Recommendation,
} from '@/engine';

import {
  checkAaveV4CollateralRiskAvailable,
  checkAaveV4DebtStateAvailable,
  mapApplicationPortfolioToEngineInput,
  resolveRiskCapacityFraction,
} from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';
import {
  formulaStep as step,
  optionsFromTracked as optionsFrom,
  type TrackedFormulaVersion,
} from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult, type ServiceWarning } from '../shared/result';

export interface TargetHealthFactorActions {
  targetHealthFactor: number;
  /** F-062 — "how much to repay, holding collateral fixed" to reach `targetHealthFactor`. */
  repayment: Recommendation;
  /** F-063 — "how much collateral to add, holding debt fixed" to reach `targetHealthFactor`. */
  additionalCollateral: Recommendation;
}

/**
 * Computes both restoration actions for one caller-supplied target
 * Health Factor. Fails as one unit (fail-fast, matching
 * `calculatePortfolioSummary`'s own sequential-dependency convention) —
 * either both recommendations are meaningful together or neither is.
 *
 * **V4 risk-capacity dispatch (V4 Readiness Audit §12 Stage 23E)** — both
 * `calculateRepaymentRecommendation` (F-062) and
 * `calculateAdditionalCollateralRecommendation` (F-063) read
 * `portfolio.protocol.liquidationThreshold` directly inside their own
 * Engine formulas, a V3-shaped assumption Stage 23D didn't reach (it only
 * wired `services/portfolio/summary.ts`/`services/simulation/scenario.ts`/
 * `services/portfolio/borrowCapacity.ts`). A leading, protocol/risk-
 * independent Engine call (`calculateCollateralValue`, which never reads
 * `debt` or `protocol`) runs first, purely to obtain real Engine metadata
 * before either V4 guard runs — `ServiceMetadata.engineVersion` must
 * always come from a real Engine call (see
 * `services/portfolio/mapping.ts`'s own `checkAaveV4DebtStateAvailable`
 * doc comment), and both real recommendation calls below need the
 * correctly-dispatched risk-capacity fraction from their very first read,
 * so neither can safely run before the guards (mirrors
 * `calculatePortfolioSummary`'s own `collateralValueStep` positioning).
 * The dispatched value is substituted into the SAME
 * `PortfolioInput.protocol.liquidationThreshold` slot both formulas
 * already read generically — never modifying the Engine, never
 * permanently redefining what `protocol.liquidationThreshold` means on
 * the persisted portfolio.
 */
export function calculateTargetHealthFactorActions(
  portfolio: ApplicationPortfolio,
  targetHealthFactor: number,
  sourceStatus: string,
): ServiceResult<TargetHealthFactorActions> {
  const engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const warnings: ServiceWarning[] = [];

  const anchorStep = step(
    calculateCollateralValue(engineInput.collateral, engineInput.market),
    null,
    sourceStatus,
  );
  if (!anchorStep.ok) return anchorStep.failure;
  let tracked: TrackedFormulaVersion = anchorStep.tracked;
  warnings.push(...anchorStep.warnings);

  // V4 Readiness Audit §12 Stage 10 — both recommendations below read
  // debt (via `engineInput`), so a V4 portfolio with no synced
  // `v4DebtState` must fail closed rather than silently recommending a
  // repayment/collateral amount computed from stale legacy `debt.balance`.
  const v4DebtGuardFailure = checkAaveV4DebtStateAvailable(portfolio, tracked, sourceStatus);
  if (v4DebtGuardFailure !== null) return v4DebtGuardFailure;

  // V4 Readiness Audit §12 Stage 23E — see this function's own doc
  // comment above.
  const v4CollateralRiskGuardFailure = checkAaveV4CollateralRiskAvailable(
    portfolio,
    tracked,
    sourceStatus,
  );
  if (v4CollateralRiskGuardFailure !== null) return v4CollateralRiskGuardFailure;

  // Non-null by construction: V3 always returns `protocol.liquidationThreshold`
  // from `resolveRiskCapacityFraction`; for V4, the guard immediately
  // above already returned on the one condition that would make it `null`.
  const riskCapacityFraction = resolveRiskCapacityFraction(portfolio)!;
  const dispatchedEngineInput = {
    ...engineInput,
    protocol: { ...engineInput.protocol, liquidationThreshold: riskCapacityFraction },
  };

  const repaymentStep = step(
    calculateRepaymentRecommendation({ portfolio: dispatchedEngineInput, targetHealthFactor }),
    tracked,
    sourceStatus,
  );
  if (!repaymentStep.ok) return repaymentStep.failure;
  tracked = repaymentStep.tracked;
  warnings.push(...repaymentStep.warnings);

  const additionalCollateralStep = step(
    calculateAdditionalCollateralRecommendation({
      portfolio: dispatchedEngineInput,
      targetHealthFactor,
    }),
    tracked,
    sourceStatus,
  );
  if (!additionalCollateralStep.ok) return additionalCollateralStep.failure;
  tracked = additionalCollateralStep.tracked;
  warnings.push(...additionalCollateralStep.warnings);

  return createServiceSuccess(
    {
      targetHealthFactor,
      repayment: repaymentStep.value,
      additionalCollateral: additionalCollateralStep.value,
    },
    optionsFrom(sourceStatus, tracked),
    warnings,
  );
}
