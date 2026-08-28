/**
 * Recommendation Explanation Model — V1.1 Batch 5 ("Recommendation
 * Quality & Explainability"). A compact, deterministic domain-level
 * structure that turns one already-computed `Recommendation` (Engine,
 * `@/engine/recommendation`) plus the current portfolio into everything
 * the UI needs to explain it: what/why/expected effect/risk/cost/
 * confidence/actionability — Section 2's own required field list.
 *
 * **Reuses Batch 3's Apply-to-Portfolio infrastructure for the quantified
 * impact, rather than re-deriving before/after math.** `repayment`
 * (F-062) and `additionalCollateral` (F-063) both already reduce to a
 * `{collateralDelta, debtDelta}` shape — the exact input
 * `buildPortfolioActionApplyProposal` (`services/portfolioApply`) already
 * accepts, and it already computes real `before`/`after`
 * `PortfolioSummary` values via `calculatePortfolioSummary` as part of
 * building a real, appliable `PortfolioApplyProposal`. Calling it here
 * gets Section 3's "HF/leverage/debt/collateral/interest-cost/liquidation
 * before → after" for free, in the SAME numbers Apply-to-Portfolio would
 * use if the user actually applies it — never a second, independently
 * computed approximation — and gets Section 7's "review/apply a valid
 * proposal" workflow link for free too: `RecommendationExplanation.applyProposal`
 * IS a `PortfolioApplyProposal`, renderable directly by the existing,
 * unmodified `ApplyToPortfolioReview` component.
 *
 * **`sourceWorkflow` reuses the existing `'exitPlanner'`/`'simulation'`
 * labels, not a new `'recommendation'` variant.** Confirmed by reading
 * every consumer of `PortfolioApplyProposal.sourceWorkflow`
 * (`stores/portfolioStore.ts`'s `applyPortfolioState`,
 * `ApplyToPortfolioReview.tsx`): the field is never branched on for
 * behavior and never rendered to the user anywhere in this codebase — it
 * exists purely as a label for future use. Repayment already routes to
 * Exit Planner and additional-collateral already routes to Simulation
 * Workspace (`RecommendationDetailPanel.tsx`'s own `RELATED_TOOL_BY_ITEM`,
 * Milestone 7 Batch 6), so reusing those exact two labels here describes
 * the real underlying mechanism (a debt repayment / a portfolio action)
 * rather than inventing a third, parallel taxonomy for what is
 * mechanically the identical delta.
 *
 * **No new financial strategy, no fabricated cost estimate.** This module
 * adds no Formula ID, no threshold, no numeric confidence percentage —
 * `RecommendationConfidence` is a caller-supplied category (this
 * Service does not compute it; see `confidence` param below), and
 * `costBenefit` is always the same honest "not modeled" statement
 * (PROJECT_STATUS.md Conflict #8, already stated by
 * `RecommendationDetailPanel.tsx`'s own pre-existing Assumptions text —
 * restated here as a structured field, not a new claim).
 */
import type { Recommendation } from '@/engine';

import type { ApplicationPortfolio } from '../portfolio/models';
import type { PortfolioSummary } from '../portfolio/summary';
import { buildPortfolioActionApplyProposal } from '../portfolioApply/buildPortfolioActionApplyProposal';
import type { PortfolioApplyProposal, PortfolioApplySourceWorkflow } from '../portfolioApply/types';

/**
 * Deterministic, caller-supplied data-quality category — Section 5.
 * "Prefer categories such as High confidence / Medium confidence /
 * Limited data, only if their rules are explicit and tested." This
 * module never invents a numeric percentage. The actual RULE that maps a
 * portfolio's live/manual/fresh/stale provenance to one of these three
 * categories lives in `utils/protocolStatus.ts`'s
 * `confidenceForProtocolStatus` — a `utils/` module, one layer above this
 * Service, since it composes `ProtocolStatusKind` (itself UI-facing live-
 * data-store state this Service layer must never import; see that
 * module's own header comment for the dependency-direction reasoning).
 * This Service only carries the already-decided category through into
 * the explanation structure.
 */
export type RecommendationConfidence = 'High confidence' | 'Medium confidence' | 'Limited data';

/** One metric's before/after pair — Section 3's quantified impact list. */
export interface RecommendationMetricChange<T> {
  before: T;
  after: T;
}

/**
 * Quantified before/after impact — Section 3. `null` only when there is
 * genuinely nothing to compute a proposed portfolio for (the
 * recommendation itself reports no action is needed, e.g.
 * `requiredRepayment === 0`) — never a fabricated zero-change row.
 * `liquidationPrice` is itself nullable per side, matching
 * `PortfolioSummary.liquidation`'s own "no liquidation risk at zero debt"
 * convention (V1.1 Batch 4).
 */
export interface RecommendationImpact {
  healthFactor: RecommendationMetricChange<number>;
  leverage: RecommendationMetricChange<number>;
  loanToValue: RecommendationMetricChange<number>;
  collateralValue: RecommendationMetricChange<number>;
  debtValue: RecommendationMetricChange<number>;
  interestCost: RecommendationMetricChange<number>;
  liquidationPrice: RecommendationMetricChange<number | null>;
}

export interface RecommendationExplanation {
  /** The recommendation this explanation was built from — every field below is derived from it, never a re-derivation. */
  recommendation: Recommendation;
  /** Section 2 "title/action" — currently identical to `suggestedAction`; kept as its own field so the UI never has to know that. */
  title: string;
  /** Section 2 "rationale" / "current-state trigger" — `Recommendation.triggeringCondition`, unchanged. */
  rationale: string;
  /** Section 4 — states a real tradeoff, factual, non-promissory. One fixed sentence per `Recommendation.category` — see `RISK_TRADEOFF_BY_CATEGORY` below. */
  risk: string;
  /** Section 3 "cost impact" — always the same honest "not modeled" statement; never a fabricated number (Conflict #8). */
  costBenefit: string;
  /** Section 5 — caller-supplied, never computed here. */
  confidence: RecommendationConfidence;
  /** `null` when the recommendation itself reports no action is needed. */
  impact: RecommendationImpact | null;
  /** Whether this recommendation has a real, non-zero change to apply or simulate. */
  isActionable: boolean;
  /**
   * Section 7 "review/apply a valid proposal" — a ready-to-render
   * `PortfolioApplyProposal`, reusing `ApplyToPortfolioReview` as-is.
   * `null` whenever `isActionable` is `false`, or building the proposal
   * failed for a reason unrelated to this explanation (defense in depth;
   * `warnings` records why).
   */
  applyProposal: PortfolioApplyProposal | null;
  warnings: string[];
}

const RISK_TRADEOFF_BY_CATEGORY: Record<Recommendation['category'], string> = {
  debtManagement:
    'Repaying debt improves Health Factor and reduces liquidation risk, but requires selling collateral or committing capital you could otherwise keep invested.',
  collateralManagement:
    'Adding collateral improves Health Factor and reduces liquidation risk, but ties up additional capital that could otherwise be deployed elsewhere.',
  leverage:
    'Adjusting leverage changes both upside exposure and liquidation sensitivity in the same direction — more leverage increases both, less leverage reduces both.',
};

const COST_BENEFIT_NOT_MODELED =
  'Execution cost not modeled — no transaction fee, slippage, or gas estimate exists for this action yet.';

function pickImpact(before: PortfolioSummary, after: PortfolioSummary): RecommendationImpact {
  return {
    healthFactor: { before: before.healthFactor, after: after.healthFactor },
    leverage: { before: before.leverage, after: after.leverage },
    loanToValue: { before: before.loanToValue, after: after.loanToValue },
    collateralValue: { before: before.collateralValue, after: after.collateralValue },
    debtValue: { before: before.debtValue, after: after.debtValue },
    interestCost: { before: before.interestCost, after: after.interestCost },
    liquidationPrice: {
      before: before.liquidation?.price ?? null,
      after: after.liquidation?.price ?? null,
    },
  };
}

function explainOne(
  sourceWorkflow: Extract<PortfolioApplySourceWorkflow, 'simulation' | 'exitPlanner'>,
  portfolio: ApplicationPortfolio,
  portfolioId: string,
  portfolioUpdatedAt: string,
  recommendation: Recommendation,
  delta: { collateralDelta: number; debtDelta: number },
  confidence: RecommendationConfidence,
): RecommendationExplanation {
  const base = {
    recommendation,
    title: recommendation.suggestedAction,
    rationale: recommendation.triggeringCondition,
    risk: RISK_TRADEOFF_BY_CATEGORY[recommendation.category],
    costBenefit: COST_BENEFIT_NOT_MODELED,
    confidence,
  };

  const noActionNeeded = delta.collateralDelta === 0 && delta.debtDelta === 0;
  if (noActionNeeded) {
    return { ...base, impact: null, isActionable: false, applyProposal: null, warnings: [] };
  }

  const proposalResult = buildPortfolioActionApplyProposal(
    sourceWorkflow,
    portfolioId,
    portfolioUpdatedAt,
    portfolio,
    delta,
  );

  if (!proposalResult.ok) {
    return {
      ...base,
      impact: null,
      isActionable: false,
      applyProposal: null,
      warnings: proposalResult.errors.map((error) => error.message),
    };
  }

  return {
    ...base,
    impact: pickImpact(proposalResult.data.before, proposalResult.data.after),
    isActionable: true,
    applyProposal: proposalResult.data,
    warnings: [],
  };
}

export interface RecommendationExplanationSet {
  repayment: RecommendationExplanation;
  additionalCollateral: RecommendationExplanation;
}

/**
 * Builds explanations for both halves of `TargetHealthFactorActions`
 * (`services/recommendation/targetHealthFactorActions.ts`) — the only
 * two recommendation types the live Recommendation Center computes (see
 * that Service's own header comment for why `generateRecommendationSet`'s
 * other two rule types are not wired here, Conflict #29 — unchanged by
 * this batch, which explains existing recommendations rather than
 * inventing the missing threshold inputs those two rules would require).
 *
 * `confidence` is shared across both — repayment and additional-collateral
 * always draw on the exact same portfolio provenance (there is no
 * per-recommendation data-quality difference for this Recommendation
 * Center), so one caller-supplied value covers both explanations.
 */
export function explainTargetHealthFactorActions(
  portfolio: ApplicationPortfolio,
  portfolioId: string,
  portfolioUpdatedAt: string,
  actions: { repayment: Recommendation; additionalCollateral: Recommendation },
  confidence: RecommendationConfidence,
): RecommendationExplanationSet {
  return {
    repayment: explainOne(
      'exitPlanner',
      portfolio,
      portfolioId,
      portfolioUpdatedAt,
      actions.repayment,
      { collateralDelta: 0, debtDelta: -actions.repayment.relevantValues.requiredRepayment },
      confidence,
    ),
    additionalCollateral: explainOne(
      'simulation',
      portfolio,
      portfolioId,
      portfolioUpdatedAt,
      actions.additionalCollateral,
      { collateralDelta: actions.additionalCollateral.relevantValues.equivalentBtc, debtDelta: 0 },
      confidence,
    ),
  };
}
