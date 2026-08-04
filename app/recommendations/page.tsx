'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { StrategyAssumptionsPanel } from '@/components/strategy/StrategyAssumptionsPanel';
import {
  RecommendationDetailPanel,
  RecommendationFilters,
  RecommendationList,
} from '@/features/recommendations';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useRecommendationCenterStore } from '@/stores/recommendationCenterStore';

/**
 * Recommendation Center Route — 06_TASKS.md M7-031 ("Create
 * Recommendation Center Route"). Dependencies: M3-012, M7-001. Priority
 * P1, Effort S. Include: "Portfolio summary, Recommendation filters,
 * Prioritized list, Recommendation details, Related actions." DoD:
 * "Users can review more recommendations than the Dashboard summary
 * displays."
 *
 * **All 5 named Include items map onto real, wired sections below.**
 * "Portfolio summary" reuses `StrategyAssumptionsPanel` (M7-004) — the
 * same shared component Loop Builder/Exit Planner already show as
 * "Current Portfolio Baseline," reused here rather than building a
 * fourth bespoke summary component. "Recommendation filters,"
 * "Prioritized list," and "Recommendation details" are
 * `RecommendationFilters` (M7-032), `RecommendationList` (M7-032), and
 * `RecommendationDetailPanel` (M7-033). "Related actions" is not a
 * separate section — it lives inside `RecommendationDetailPanel` itself
 * (M7-034), the same "Action Links depend on the Detail Panel" ordering
 * `06_TASKS.md` already documents (M7-034's own Dependencies: M7-033).
 *
 * **Recalculation (M7-036)** is driven entirely by this route's own
 * `useEffect`, keyed on `[activePortfolioId, record?.portfolio.updatedAt]`
 * — see `stores/recommendationCenterStore.ts`'s own header comment for
 * why that one dependency pair covers all five documented triggers
 * (price/position/protocol/interest-rate update, active portfolio
 * switch) without recomputing on unrelated re-renders.
 *
 * **No active portfolio → the same minimal gate `app/loop-builder/page.tsx`/
 * `app/exit-planner/page.tsx` already establish at their own foundation
 * task** ("Select or create one"). A fuller, cross-tool "No current
 * recommendations" empty-state treatment is explicitly M7-037's own job
 * (Batch 7, "Implement Strategy Loading and Empty States," which
 * depends on this route already existing) — not duplicated or
 * preempted here.
 *
 * **M7-045 ("Validate Strategy Tools Against UI Specification"), Batch
 * 8 — nothing to audit this route against.** `03_UI.md`'s own 10-page
 * index has no Recommendation Center page and no sidebar entry for one
 * anywhere — already found and recorded at Milestone 7 Batch 1, the
 * same shape as Conflict #23 (the Portfolio List page). Terminology,
 * required outputs, Warnings, and Assumptions were instead spot-checked
 * directly against `06_TASKS.md`'s own M7-031 through M7-036 task text
 * (this route's real authoritative source) and found consistent.
 * Responsive behavior and Accessibility were already validated this
 * same batch (M7-039/M7-040).
 */
export default function RecommendationsPage() {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );
  const lastMetadata = useRecommendationCenterStore((state) => state.lastMetadata);
  const recalculate = useRecommendationCenterStore((state) => state.recalculate);

  useEffect(() => {
    if (record !== undefined) {
      recalculate(record.portfolio);
    }
    // `recalculate` is a stable Zustand action reference; `record.portfolio.updatedAt`
    // already changes on every collateral/debt/market/protocol edit
    // (stores/portfolioStore.ts's own `update()`), and `activePortfolioId`
    // changes on a portfolio switch — together the exact five M7-036
    // triggers, nothing more.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePortfolioId, record?.portfolio.updatedAt]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Recommendation Center
        </h1>
        <p className="text-sm text-muted-foreground">What actions are suggested?</p>
      </div>

      {activePortfolioId === null || record === undefined ? (
        <p className="text-sm text-muted-foreground">
          No portfolio is currently selected.{' '}
          <Link href="/portfolios" className="underline">
            Select or create one
          </Link>{' '}
          to see recommendations.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-2 rounded-md border border-border p-4">
            <h2 className="text-sm font-medium text-foreground">Portfolio Summary</h2>
            <StrategyAssumptionsPanel
              portfolio={record.portfolio}
              metadata={lastMetadata}
              timeHorizonLabel={null}
            />
          </section>

          <section className="flex flex-col gap-2 rounded-md border border-border p-4">
            <h2 className="text-sm font-medium text-foreground">Filters</h2>
            <RecommendationFilters />
          </section>

          <div className="flex flex-col gap-6 lg:flex-row">
            <section
              aria-label="Prioritized Recommendations"
              className="flex flex-1 flex-col gap-2 rounded-md border border-border p-4"
            >
              <h2 className="text-sm font-medium text-foreground">Recommendations</h2>
              <RecommendationList portfolio={record.portfolio} />
            </section>

            <section
              aria-label="Recommendation Detail"
              className="flex flex-1 flex-col gap-2 rounded-md border border-border p-4 lg:max-w-md"
            >
              <h2 className="text-sm font-medium text-foreground">Recommendation Detail</h2>
              <RecommendationDetailPanel portfolio={record.portfolio} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
