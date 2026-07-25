export {
  type AdditionalCollateralRecommendationParams,
  calculateAdditionalCollateralRecommendation,
} from './calculateAdditionalCollateralRecommendation';
export {
  type BorrowRecommendationParams,
  calculateBorrowRecommendation,
} from './calculateBorrowRecommendation';
export {
  calculateLoopRecommendation,
  type LoopRecommendationParams,
} from './calculateLoopRecommendation';
export {
  calculateRepaymentRecommendation,
  type RepaymentRecommendationParams,
} from './calculateRepaymentRecommendation';
export {
  generateRecommendations,
  type GenerateRecommendationsParams,
  type RecommendationRuleConfig,
  type RecommendationSet,
  type UnavailableRecommendationCategory,
} from './generateRecommendations';
export type { DecisionPriority, Recommendation, RecommendationCategory } from './types';
