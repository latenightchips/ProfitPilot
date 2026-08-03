'use client';

import { RECOMMENDATION_FILTER_CATEGORIES } from '@/features/recommendations/utils/recommendationTaxonomy';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';

/**
 * Recommendation Filters — 06_TASKS.md M7-032 ("Implement Recommendation
 * List"). Filter by: "Safety / Debt / Collateral / Interest / Leverage /
 * Exit readiness." Pure filter selector — `RecommendationList.tsx` reads
 * `categoryFilter` and decides what to render for each category,
 * including the four that are always unavailable (see
 * `recommendationTaxonomy.ts`'s own `UNAVAILABLE_FILTER_REASONS`); this
 * component only sets which one is selected.
 */
export function RecommendationFilters() {
  const categoryFilter = useRecommendationCenterStore((state) => state.categoryFilter);
  const setCategoryFilter = useRecommendationCenterStore((state) => state.setCategoryFilter);

  return (
    <div
      role="group"
      aria-label="Filter recommendations by category"
      className="flex flex-wrap gap-2"
    >
      <button
        type="button"
        onClick={() => setCategoryFilter('all')}
        aria-pressed={categoryFilter === 'all'}
        className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
          categoryFilter === 'all'
            ? 'border-foreground bg-foreground text-background'
            : 'border-border text-foreground/80 hover:bg-accent/40'
        }`}
      >
        All
      </button>
      {RECOMMENDATION_FILTER_CATEGORIES.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => setCategoryFilter(category.id)}
          aria-pressed={categoryFilter === category.id}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            categoryFilter === category.id
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-foreground/80 hover:bg-accent/40'
          }`}
        >
          {category.label}
        </button>
      ))}
    </div>
  );
}
