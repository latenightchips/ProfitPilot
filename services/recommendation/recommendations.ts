/**
 * Recommendation Service — 06_TASKS.md M3-012 ("Implement Recommendation
 * Service"): "Generate transparent recommendations from calculated
 * portfolio data." Include: Priority, Category, Risk level, Explanation,
 * Suggested action, Expected effect, Relevant Formula IDs. DoD:
 * "Recommendations are deterministic, explainable, and ordered
 * consistently."
 *
 * A single Engine call: `generateRecommendations` (M2-025/M2-026,
 * `@/engine`) already composes all four implemented recommendation rules
 * (Debt management, Repayment, Additional Collateral, Leverage/Loop) into
 * one `RecommendationSet`, each entry already carrying exactly M2-026's
 * six required fields — category, triggeringCondition ("Explanation"),
 * relevantValues, expectedEffect, decisionPriority ("Risk level"),
 * suggestedAction, formulaReferences ("Relevant Formula IDs"). No
 * multi-call composition or formula-version tracking is needed here,
 * unlike M3-005/M3-009.
 *
 * **"Priority" — the one field `generateRecommendations` doesn't already
 * provide.** `engine/recommendation/types.ts` documents an explicit,
 * ordered five-tier "DECISION PRIORITY" list (Prevent Liquidation >
 * Maintain Target Health Factor > Reduce Interest Costs > Improve
 * Capital Efficiency > Achieve User Goals — 02_Formulas.md's Recommendation
 * Engine chapter, page 8), already used as `Recommendation.decisionPriority`
 * ("Risk level"). `generateRecommendations` itself returns recommendations
 * in a fixed structural order (borrow, repayment, additionalCollateral,
 * loop), not priority-ordered. This Service sorts by that same documented
 * tier order and attaches a 1-based `priority` rank — satisfying both
 * M3-012's own "Priority" field and the DoD's "ordered consistently"
 * without inventing a new priority scheme (the tiers and their order are
 * the Formula chapter's own, not invented here).
 *
 * **`RecommendationRuleConfig` is entirely caller-supplied.** Thresholds
 * like `userMinHealthFactor`, `targetDebtRatio`, `targetHealthFactor`,
 * `loopBorrowPercentage`, and `maxAcceptableAnnualInterestCost` are
 * portfolio-owner preferences with no documented default value anywhere
 * — inventing defaults would mean guessing at user intent, so this
 * Service requires them as an explicit parameter, the same "never
 * fabricate what the Service doesn't own" principle as `sourceStatus`.
 *
 * **`unavailableCategories` is preserved, not dropped.** `generateRecommendations`
 * already reports which of the six documented recommendation categories
 * (Safety, Interest cost, Exit readiness) are unavailable and why —
 * dropping that here would silently hide real, already-documented
 * specification gaps (conflicts #1, #7-adjacent, #11) from anything
 * consuming this Service.
 */
import {
  calculateCollateralValue,
  type DecisionPriority,
  generateRecommendations,
  type Recommendation,
  type RecommendationRuleConfig,
  type UnavailableRecommendationCategory,
} from '@/engine';

import {
  checkAaveV4CollateralRiskAvailable,
  checkAaveV4DebtStateAvailable,
  deriveAaveV4EffectiveBorrowRate,
  mapApplicationPortfolioToEngineInput,
  resolveRiskCapacityFraction,
} from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';
import { type ApplicationError, createApplicationError } from '../shared/errors';
import { formulaStep as step, type TrackedFormulaVersion } from '../shared/formulaStep';
import {
  createServiceFailure,
  createServiceSuccess,
  type ServiceResult,
  type ServiceWarning,
} from '../shared/result';

/** 02_Formulas.md's Recommendation Engine chapter (page 8) "DECISION PRIORITY" order, highest first. */
const DECISION_PRIORITY_ORDER: DecisionPriority[] = [
  'Prevent Liquidation',
  'Maintain Target Health Factor',
  'Reduce Interest Costs',
  'Improve Capital Efficiency',
  'Achieve User Goals',
];

export interface RankedRecommendation extends Recommendation {
  /** 1-based rank per the documented Decision Priority order (1 = highest priority). */
  priority: number;
}

export interface RecommendationResult {
  recommendations: RankedRecommendation[];
  unavailableCategories: UnavailableRecommendationCategory[];
}

/**
 * Generates a deterministic, priority-ordered recommendation set —
 * 06_TASKS.md M3-012. `rules` and `sourceStatus` are caller-supplied
 * (see this file's header comment); neither is fabricated here.
 */
export function generateRecommendationSet(
  portfolio: ApplicationPortfolio,
  rules: RecommendationRuleConfig,
  sourceStatus: string,
): ServiceResult<RecommendationResult> {
  let engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const warnings: ServiceWarning[] = [];

  // V4 Readiness Audit §12 Stage 23E — a leading, protocol/risk-
  // independent Engine call (never reads debt or protocol), purely to
  // obtain real Engine metadata before either V4 guard below runs —
  // `ServiceMetadata.engineVersion` must always come from a real Engine
  // call (see `services/portfolio/mapping.ts`'s own
  // `checkAaveV4DebtStateAvailable` doc comment), and the borrow-rate and
  // risk-capacity dispatches below both need to run before
  // `generateRecommendations`'s own first call, so neither can safely be
  // that anchor (mirrors `calculatePortfolioSummary`'s own
  // `collateralValueStep` positioning and
  // `calculateTargetHealthFactorActions`'s identical Stage 23E fix).
  const anchorStep = step(
    calculateCollateralValue(engineInput.collateral, engineInput.market),
    null,
    sourceStatus,
  );
  if (!anchorStep.ok) return anchorStep.failure;
  const tracked: TrackedFormulaVersion = anchorStep.tracked;
  warnings.push(...anchorStep.warnings);

  // V4 Readiness Audit §12 Stage 10 — `generateRecommendations` below
  // reads debt throughout, so a V4 portfolio with no synced `v4DebtState`
  // must fail closed rather than silently computing recommendations from
  // stale legacy `debt.balance`. Moved earlier than this guard's original
  // Stage 10 position (previously ran AFTER `generateRecommendations`,
  // discarding an already-computed result on failure) now that a real
  // `tracked` is available this early via the anchor call above —
  // `ServiceFailure` carries no `warnings` field, so this is not an
  // observable behavior change, only less wasted computation.
  const v4DebtGuardFailure = checkAaveV4DebtStateAvailable(portfolio, tracked, sourceStatus);
  if (v4DebtGuardFailure !== null) return v4DebtGuardFailure;

  // V4 Readiness Audit §12 Stage 23E — `calculateBorrowRecommendation`
  // (F-061, via `calculateAvailableBorrow`/`calculateHealthFactor`) and
  // `calculateLoopRecommendation`'s `calculateLoopStep` (F-014) both read
  // `portfolio.protocol.liquidationThreshold`/`.maxLoanToValue` directly
  // inside `generateRecommendations`, a V3-shaped assumption Stage 23D
  // didn't reach.
  const v4CollateralRiskGuardFailure = checkAaveV4CollateralRiskAvailable(
    portfolio,
    tracked,
    sourceStatus,
  );
  if (v4CollateralRiskGuardFailure !== null) return v4CollateralRiskGuardFailure;

  // V4 Readiness Audit §12 Stage 15 — `generateRecommendations` below
  // internally calls `calculateLoopRecommendation`, which reads
  // `engineInput.protocol.borrowApr` for its "how much more could you
  // loop" cost estimate. That legacy V3 scalar is not the real V4 rate
  // for a V4 portfolio with synced `v4DebtState`; substitute the real,
  // derived effective rate before the Engine call runs. `v4DebtGuardFailure`
  // above already confirmed `v4DebtState` is present whenever
  // `protocolVersion === 'v4'` reaches this point, so deriving from it is
  // always safe here.
  if (portfolio.protocolVersion === 'v4' && portfolio.v4DebtState !== undefined) {
    const rateStep = deriveAaveV4EffectiveBorrowRate(portfolio.v4DebtState, tracked, sourceStatus);
    if (!rateStep.ok) return rateStep.failure;
    engineInput = {
      ...engineInput,
      protocol: { ...engineInput.protocol, borrowApr: rateStep.value },
    };
  }

  // V4 Readiness Audit §12 Stage 23E — `liquidationThreshold`/
  // `maxLoanToValue` dispatch for V4 (Stage 23B: V4 has no separate
  // max-LTV/liquidation-threshold split — `collateralFactor` alone
  // governs both borrow capacity and liquidation eligibility, so both
  // V3-shaped fields are set to the same dispatched value).
  // `v4CollateralRiskGuardFailure` above already confirmed
  // `v4CollateralRisk` is present whenever `protocolVersion === 'v4'`
  // reaches this point.
  if (portfolio.protocolVersion === 'v4') {
    const riskCapacityFraction = resolveRiskCapacityFraction(portfolio)!;
    engineInput = {
      ...engineInput,
      protocol: {
        ...engineInput.protocol,
        liquidationThreshold: riskCapacityFraction,
        maxLoanToValue: riskCapacityFraction,
      },
    };
  }

  const result = generateRecommendations({ portfolio: engineInput, rules });

  if (!result.ok) {
    const error: ApplicationError = createApplicationError(
      'calculation',
      result.error.code,
      result.error.message,
    );
    return createServiceFailure([error], {
      sourceStatus,
      engineVersion: result.metadata.engineVersion,
      formulaVersion: result.metadata.formulaVersion,
    });
  }

  const ranked: RankedRecommendation[] = [...result.value.recommendations]
    .sort(
      (a, b) =>
        DECISION_PRIORITY_ORDER.indexOf(a.decisionPriority) -
        DECISION_PRIORITY_ORDER.indexOf(b.decisionPriority),
    )
    .map((recommendation, index) => ({ ...recommendation, priority: index + 1 }));

  return createServiceSuccess(
    { recommendations: ranked, unavailableCategories: result.value.unavailableCategories },
    {
      sourceStatus,
      engineVersion: result.metadata.engineVersion,
      formulaVersion: result.metadata.formulaVersion,
    },
    [...warnings, ...result.warnings],
  );
}
