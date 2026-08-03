/**
 * Recommendation Center feature module — public entry point.
 * 06_TASKS.md M7-001 ("Create Strategy Feature Foundations"). See
 * `features/loop-builder/index.ts`'s own header comment for the full
 * reasoning shared by all three Milestone 7 feature modules.
 *
 * Milestone 7 Batch 6 (M7-031–M7-036) adds the first real components
 * (`RecommendationFilters`, `RecommendationList`,
 * `RecommendationDetailPanel`) and the first real `utils/` content
 * (`recommendationTaxonomy.ts`). `hooks/`, `services/`, `types/` still
 * hold only a `.gitkeep` — no task has needed them: recalculation
 * triggering lives in `app/recommendations/page.tsx`'s own `useEffect`
 * (the same pattern Loop Builder/Exit Planner's own routes already
 * establish), and every type this batch needs is either already public
 * from `@/services` or owned by `stores/recommendationCenterStore.ts`
 * (matching `stores/exitPlannerStore.ts`'s own `ExitPlannerType`
 * precedent).
 */
export { RecommendationDetailPanel } from './components/RecommendationDetailPanel';
export { RecommendationFilters } from './components/RecommendationFilters';
export { RecommendationList } from './components/RecommendationList';
export * from './utils/recommendationTaxonomy';
