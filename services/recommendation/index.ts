/**
 * Recommendation Service — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-012 ("Implement Recommendation Service") is its first
 * occupant. `calculateTargetHealthFactorActions` was added in Milestone 5
 * Batch 4 — see that file's own header comment for why it exists
 * alongside `generateRecommendationSet` rather than reusing it.
 * `Recommendation` (M2-026's own type, already public from `@/engine`)
 * is re-exported here so callers of `TargetHealthFactorActions` never
 * need to import `@/engine` directly — the UI layer stays within its
 * documented "UI → Services" boundary (Build Guide "DEPENDENCY RULES").
 * `DecisionPriority`/`RecommendationCategory` (also `@/engine`-owned)
 * are re-exported the same way, added in Milestone 7 Batch 6 for the
 * Recommendation Center's own severity/filter-category display mapping
 * (`features/recommendations/utils/recommendationTaxonomy.ts`) — no
 * Engine file changes were needed for that addition, only this barrel.
 */
export {
  explainTargetHealthFactorActions,
  type RecommendationConfidence,
  type RecommendationExplanation,
  type RecommendationExplanationSet,
  type RecommendationImpact,
  type RecommendationMetricChange,
} from './explainRecommendation';
export {
  generateRecommendationSet,
  type RankedRecommendation,
  type RecommendationResult,
} from './recommendations';
export {
  calculateTargetHealthFactorActions,
  type TargetHealthFactorActions,
} from './targetHealthFactorActions';
export type { DecisionPriority, Recommendation, RecommendationCategory } from '@/engine';
