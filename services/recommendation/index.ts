/**
 * Recommendation Service — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-012 ("Implement Recommendation Service") is its first
 * occupant. `calculateTargetHealthFactorActions` was added in Milestone 5
 * Batch 4 — see that file's own header comment for why it exists
 * alongside `generateRecommendationSet` rather than reusing it.
 */
export {
  generateRecommendationSet,
  type RankedRecommendation,
  type RecommendationResult,
} from './recommendations';
export {
  calculateTargetHealthFactorActions,
  type TargetHealthFactorActions,
} from './targetHealthFactorActions';
