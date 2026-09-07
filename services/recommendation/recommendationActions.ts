/**
 * Recommendation Actions — v1.18.0 Batch 2 (Recommendation Service
 * Integration). Implements `docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md`
 * §6.1: the canonical composition that safely combines F-061 Borrow,
 * F-062 Repayment, F-063 Additional Collateral, and F-064 Loop according
 * to the per-portfolio Recommendation Preferences contract (Batch 1,
 * `types/portfolio.ts`'s `RecommendationPreferences`), without requiring
 * `generateRecommendationSet`'s all-or-nothing `RecommendationRuleConfig`.
 *
 * **Why not `generateRecommendationSet` (M3-012)?** That Service's
 * `RecommendationRuleConfig` is one non-optional object — Borrow/Loop
 * would stay unavailable merely because the *other* rule's preferences
 * aren't configured yet, defeating spec §5's independence requirement.
 * It is also not modified — spec §11 requires F-061/F-062/F-063/F-064
 * unchanged, and that Service is directly, exhaustively tested today
 * exactly as an all-or-nothing composition.
 *
 * **Why not call `calculateTargetHealthFactorActions` as a sub-call?**
 * This function needs the SAME V4-dispatched `PortfolioInput` for all
 * four rules (Borrow and Loop both read the dispatched
 * `liquidationThreshold`/`maxLoanToValue`, exactly like Repayment/
 * Additional Collateral already do) — computing that dispatch once and
 * calling all four already-public Engine rule functions directly with it
 * avoids a redundant second anchor call and a redundant second pass
 * through the V4 guards `calculateTargetHealthFactorActions` would run
 * internally. This mirrors, not duplicates, financial logic: the four
 * Engine rule functions called below (`calculateRepaymentRecommendation`,
 * `calculateAdditionalCollateralRecommendation`,
 * `calculateBorrowRecommendation`, `calculateLoopRecommendation`) are the
 * exact same functions `generateRecommendationSet` and
 * `calculateTargetHealthFactorActions` already call — this file adds no
 * new Engine call, only a third, independent copy of the same
 * dispatch-sequencing *orchestration* those two files already each carry
 * their own copy of (the established precedent for this exact V4-dispatch
 * sequence in this codebase — see `recommendations.ts`'s and
 * `targetHealthFactorActions.ts`'s own header comments). The guard/derive
 * functions themselves (`checkAaveV4DebtStateAvailable`,
 * `checkAaveV4DebtAssetPriceAvailable`, `checkAaveV4CollateralRiskAvailable`,
 * `deriveAaveV4EffectiveBorrowRate`, `resolveRiskCapacityFraction`) are
 * reused unchanged, never reimplemented.
 *
 * **Reads `targetHealthFactor`/`recommendationPreferences` directly off
 * `Portfolio`, unlike `calculateTargetHealthFactorActions`'s
 * caller-supplied-target convention.** This function's whole purpose is
 * to be callable without the caller pre-extracting or pre-validating
 * anything — the same "a Service function that needs settings data reads
 * it directly off a `Portfolio`-typed parameter" precedent
 * `services/portfolio/startingValueBaseline.ts` already established for
 * exactly this reason (that file's own header comment). Takes `Portfolio`
 * (`@/types/portfolio`), not the narrower `ApplicationPortfolio`
 * (`services/portfolio/models.ts`) every other Recommendation Service
 * function takes — `ApplicationPortfolio` deliberately carries no
 * `settings` field (that file's own SCOPE NOTE), so a function that reads
 * `portfolio.settings.*` internally needs the fuller type. `Portfolio`
 * extends `ApplicationPortfolio`, so every existing helper this file
 * calls (`mapApplicationPortfolioToEngineInput`, the V4 guards) accepts
 * it structurally, unchanged.
 *
 * **The one deliberate structural deviation from spec §6.1's own
 * pseudocode**: that section's illustrative code block types the
 * parameter as `ApplicationPortfolio`, but also specifies a 2-argument
 * signature (`portfolio`, `sourceStatus` only — no separate
 * `targetHealthFactor` parameter) and a function that "reads
 * `targetHealthFactor` from `portfolio.settings.safetyTargets`" itself.
 * Those two requirements are only satisfiable together if `portfolio` is
 * typed `Portfolio` (which has `settings`), not `ApplicationPortfolio`
 * (which does not) — the pseudocode's type annotation was illustrative,
 * not literal; this file follows the section's own stated *behavior*
 * exactly.
 */
import {
  calculateAdditionalCollateralRecommendation,
  calculateBorrowRecommendation,
  calculateCollateralValue,
  calculateLoopRecommendation,
  calculateRepaymentRecommendation,
  type Recommendation,
} from '@/engine';
import type { Portfolio } from '@/types/portfolio';

import {
  checkAaveV4CollateralRiskAvailable,
  checkAaveV4DebtAssetPriceAvailable,
  checkAaveV4DebtStateAvailable,
  deriveAaveV4EffectiveBorrowRate,
  mapApplicationPortfolioToEngineInput,
  resolveRiskCapacityFraction,
} from '../portfolio/mapping';
import { formulaStep as step, type TrackedFormulaVersion } from '../shared/formulaStep';
import { createServiceSuccess, type ServiceResult, type ServiceWarning } from '../shared/result';

/**
 * Spec §6.1's own `RecommendationItemId` — the four items the Recommendation
 * Center can ever surface, `'repayment'`/`'additionalCollateral'` (already
 * shipped) plus the two this batch makes computable, `'borrow'`/`'loop'`.
 */
export type RecommendationItemId = 'repayment' | 'additionalCollateral' | 'borrow' | 'loop';

/**
 * Spec §6.1's own output shape. `items` holds only the items whose full
 * required preference set was present (spec §5's partial-configuration
 * table); `unavailableReasons` holds a real, sourced reason for every
 * item NOT in `items` — never an omission. A key can appear in at most
 * one of the two records for a given result.
 */
export interface RecommendationActionsResult {
  targetHealthFactor: number | null;
  items: Partial<Record<RecommendationItemId, Recommendation>>;
  unavailableReasons: Partial<Record<RecommendationItemId, string>>;
}

const NO_TARGET_REASON =
  'No target Health Factor is configured for this portfolio yet — set one in Portfolio Settings → Safety Targets.';

const BORROW_UNAVAILABLE_REASON =
  'Configure your minimum Health Factor and target Debt Ratio in Portfolio Settings → Recommendation Preferences to see Borrow recommendations here.';

const LOOP_UNAVAILABLE_REASON =
  'Configure your Loop borrow percentage and maximum acceptable annual interest cost in Portfolio Settings → Recommendation Preferences to see Loop recommendations here.';

/**
 * Generates whichever recommendation actions this portfolio's own
 * configuration currently supports — spec §6.1. Never all-or-nothing:
 * Repayment/Additional Collateral depend only on `targetHealthFactor`
 * (unchanged from `calculateTargetHealthFactorActions`'s own scope);
 * Borrow depends additionally, and independently, on both
 * `recommendationPreferences.borrow` fields; Loop depends additionally,
 * and independently, on both `recommendationPreferences.loop` fields.
 * Neither Borrow's nor Loop's availability affects the other's, or
 * Repayment/Additional Collateral's (spec §5).
 *
 * Fails as one unit (the existing `ServiceResult` failure convention)
 * only when a *computed* item's own Engine call genuinely fails (a V4
 * guard, or an out-of-range persisted value reaching the Engine's own
 * validation) — an absent preference is never a failure, only an
 * unavailable item (spec §6.1 step 6).
 */
export function calculateRecommendationActions(
  portfolio: Portfolio,
  sourceStatus: string,
): ServiceResult<RecommendationActionsResult> {
  const engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const warnings: ServiceWarning[] = [];

  // Anchor call — protocol/debt-independent, purely to obtain real Engine
  // metadata before either the "no target" short-circuit below or the V4
  // guards run. Same precedent as `generateRecommendationSet`'s/
  // `calculateTargetHealthFactorActions`'s own identical anchor call:
  // `ServiceMetadata.engineVersion` must always come from a real Engine
  // call (`services/shared/result.ts`'s own `CreateServiceResultOptions.engineVersion`
  // doc comment), never a separately maintained constant — this is true
  // even for the "no target configured" result below, which computes no
  // recommendation but still returns real, honest metadata rather than a
  // fabricated one.
  const anchorStep = step(
    calculateCollateralValue(engineInput.collateral, engineInput.market),
    null,
    sourceStatus,
  );
  if (!anchorStep.ok) return anchorStep.failure;
  let tracked: TrackedFormulaVersion = anchorStep.tracked;
  warnings.push(...anchorStep.warnings);

  const targetHealthFactor = portfolio.settings.safetyTargets?.targetHealthFactor ?? null;

  // Spec §6.1 step 1 — matches `recommendationCenterStore.ts`'s own
  // existing `'noTarget'` short-circuit precedent: no recommendation
  // Engine call is made when no target Health Factor is configured, for
  // any of the four items, including Borrow (whose own Engine parameters
  // do not technically require `targetHealthFactor` — this is a
  // deliberate whole-function gate per spec §5's own table, not an
  // incidental omission).
  if (targetHealthFactor === null) {
    return createServiceSuccess(
      {
        targetHealthFactor: null,
        items: {},
        unavailableReasons: {
          repayment: NO_TARGET_REASON,
          additionalCollateral: NO_TARGET_REASON,
          borrow: NO_TARGET_REASON,
          loop: NO_TARGET_REASON,
        },
      },
      {
        sourceStatus,
        engineVersion: tracked.engineVersion,
        formulaVersion: tracked.formulaVersion,
      },
      warnings,
    );
  }

  // V4 Readiness Audit §12 Stage 10 — every item below reads debt, so a
  // V4 portfolio with no synced `v4DebtState` must fail closed rather
  // than silently computing from stale legacy `debt.balance`. Same
  // guard, same call, as `generateRecommendationSet`/
  // `calculateTargetHealthFactorActions`.
  const v4DebtGuardFailure = checkAaveV4DebtStateAvailable(portfolio, tracked, sourceStatus);
  if (v4DebtGuardFailure !== null) return v4DebtGuardFailure;

  // V4 Readiness Audit §12 P1-D3 — same fail-closed discipline as the
  // guard above, now for a 'live'-sourced `v4DebtState` missing its
  // authoritative debt-asset oracle price.
  const v4PriceGuardFailure = checkAaveV4DebtAssetPriceAvailable(portfolio, tracked, sourceStatus);
  if (v4PriceGuardFailure !== null) return v4PriceGuardFailure;

  // V4 Readiness Audit §12 Stage 23E — Borrow and Loop both read
  // `protocol.liquidationThreshold`/`.maxLoanToValue` directly inside
  // their own Engine formulas (Loop via `calculateLoopStep`), a V3-shaped
  // assumption Stage 23D didn't reach.
  const v4CollateralRiskGuardFailure = checkAaveV4CollateralRiskAvailable(
    portfolio,
    tracked,
    sourceStatus,
  );
  if (v4CollateralRiskGuardFailure !== null) return v4CollateralRiskGuardFailure;

  // V4 Readiness Audit §12 Stage 15 — Loop's own interest-cost check
  // (`calculateAnnualInterest`, inside `calculateLoopRecommendation`)
  // reads `engineInput.protocol.borrowApr`; that legacy V3 scalar is not
  // the real V4 rate for a V4 portfolio with synced `v4DebtState`.
  // Harmless to apply to the shared dispatched input even though only
  // Loop consumes `borrowApr` — Repayment/Additional Collateral/Borrow
  // never read it. `v4DebtGuardFailure` above already confirmed
  // `v4DebtState` is present whenever `protocolVersion === 'v4'` reaches
  // this point.
  let dispatchedEngineInput = engineInput;
  if (portfolio.protocolVersion === 'v4' && portfolio.v4DebtState !== undefined) {
    const rateStep = deriveAaveV4EffectiveBorrowRate(portfolio.v4DebtState, tracked, sourceStatus);
    if (!rateStep.ok) return rateStep.failure;
    dispatchedEngineInput = {
      ...dispatchedEngineInput,
      protocol: { ...dispatchedEngineInput.protocol, borrowApr: rateStep.value },
    };
  }

  // V4 Readiness Audit §12 Stage 23E — `liquidationThreshold`/
  // `maxLoanToValue` dispatch for V4 (Stage 23B: no separate max-LTV/
  // liquidation-threshold split — `collateralFactor` alone governs both
  // borrow capacity and liquidation eligibility). `v4CollateralRiskGuardFailure`
  // above already confirmed `v4CollateralRisk` is present whenever
  // `protocolVersion === 'v4'` reaches this point.
  if (portfolio.protocolVersion === 'v4') {
    const riskCapacityFraction = resolveRiskCapacityFraction(portfolio)!;
    dispatchedEngineInput = {
      ...dispatchedEngineInput,
      protocol: {
        ...dispatchedEngineInput.protocol,
        liquidationThreshold: riskCapacityFraction,
        maxLoanToValue: riskCapacityFraction,
      },
    };
  }

  // Repayment/Additional Collateral — unconditional once `targetHealthFactor`
  // exists, exactly matching `calculateTargetHealthFactorActions`'s own
  // scope and behavior (same Engine functions, same dispatched input).
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

  const items: Partial<Record<RecommendationItemId, Recommendation>> = {
    repayment: repaymentStep.value,
    additionalCollateral: additionalCollateralStep.value,
  };
  const unavailableReasons: Partial<Record<RecommendationItemId, string>> = {};

  // Borrow — independent of Loop (spec §5). Available iff both
  // `recommendationPreferences.borrow` fields are set; never a partial
  // substitution.
  const borrowPreferences = portfolio.settings.recommendationPreferences?.borrow;
  if (
    borrowPreferences?.userMinHealthFactor !== undefined &&
    borrowPreferences?.targetDebtRatio !== undefined
  ) {
    const borrowStep = step(
      calculateBorrowRecommendation({
        portfolio: dispatchedEngineInput,
        userMinHealthFactor: borrowPreferences.userMinHealthFactor,
        targetDebtRatio: borrowPreferences.targetDebtRatio,
      }),
      tracked,
      sourceStatus,
    );
    if (!borrowStep.ok) return borrowStep.failure;
    tracked = borrowStep.tracked;
    warnings.push(...borrowStep.warnings);
    items.borrow = borrowStep.value;
  } else {
    unavailableReasons.borrow = BORROW_UNAVAILABLE_REASON;
  }

  // Loop — independent of Borrow (spec §5). Available iff both
  // `recommendationPreferences.loop` fields are set (in addition to the
  // already-checked `targetHealthFactor`); never a partial substitution.
  const loopPreferences = portfolio.settings.recommendationPreferences?.loop;
  if (
    loopPreferences?.loopBorrowPercentage !== undefined &&
    loopPreferences?.maxAcceptableAnnualInterestCost !== undefined
  ) {
    const loopStep = step(
      calculateLoopRecommendation({
        portfolio: dispatchedEngineInput,
        targetHealthFactor,
        loopBorrowPercentage: loopPreferences.loopBorrowPercentage,
        maxAcceptableAnnualInterestCost: loopPreferences.maxAcceptableAnnualInterestCost,
      }),
      tracked,
      sourceStatus,
    );
    if (!loopStep.ok) return loopStep.failure;
    tracked = loopStep.tracked;
    warnings.push(...loopStep.warnings);
    items.loop = loopStep.value;
  } else {
    unavailableReasons.loop = LOOP_UNAVAILABLE_REASON;
  }

  return createServiceSuccess(
    { targetHealthFactor, items, unavailableReasons },
    { sourceStatus, engineVersion: tracked.engineVersion, formulaVersion: tracked.formulaVersion },
    warnings,
  );
}
