import { create } from 'zustand';

import {
  type ApplicationError,
  calculateTargetHealthFactorActions,
  type ServiceMetadata,
  type TargetHealthFactorActions,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';

/**
 * Recommendation Center Store — 06_TASKS.md M7-032 ("Implement
 * Recommendation List"), M7-035 ("Implement Recommendation
 * Acknowledgement"), M7-036 ("Implement Recommendation Recalculation").
 * Independent from `portfolioStore`/`loopBuilderStore`/`exitPlannerStore`
 * except through their public interfaces — the same independence
 * discipline the Batch 5/Batch 2 kickoffs already established for Exit
 * Planner/Loop Builder, reused here per this batch's own instruction.
 * `app/recommendations/page.tsx` reads the active portfolio from
 * `usePortfolioStore` and passes the plain `Portfolio` value into
 * `recalculate` — this Store never imports or reads `portfolioStore`
 * itself, and never writes back to it (recommendations only ever read a
 * portfolio, never mutate one — see this file's own `recalculate`
 * comment).
 *
 * **Why this Store calls `calculateTargetHealthFactorActions`, not
 * `generateRecommendationSet`.** `generateRecommendationSet` (M3-012, `@/services`) is the only Service
 * that returns all four implemented recommendation categories (borrow,
 * repayment, additionalCollateral, loop), but requires a complete
 * `RecommendationRuleConfig` — `borrow.userMinHealthFactor`,
 * `borrow.targetDebtRatio`, `loop.loopBorrowPercentage`,
 * `loop.maxAcceptableAnnualInterestCost` have no portfolio-level source
 * and no documented default anywhere (PROJECT_STATUS.md conflict #29).
 * Calling it here would mean fabricating four threshold values this
 * Recommendation Center has no honest way to obtain — exactly the
 * "unsupported... cost assumptions" this batch's own instructions say
 * not to invent. `calculateTargetHealthFactorActions`
 * (`services/recommendation/targetHealthFactorActions.ts`, Milestone 5
 * Batch 4) needs only `targetHealthFactor`, which has a real source —
 * `Portfolio.settings.safetyTargets.targetHealthFactor` (M4-001) — and
 * is the same Service `features/dashboard/utils/buildRecommendationSummary.ts`
 * (M5-015) already uses for the same reason. This Recommendation Center
 * still reviews "more... than the Dashboard summary displays" (M7-031's
 * own DoD) three ways the Dashboard summary does not: (1) it always
 * shows both the repayment and additional-collateral recommendations,
 * including the real "no action needed" case the Dashboard's own
 * `buildRecommendationSummary` silently drops (`requiredRepayment > 0`
 * gate) rather than displaying; (2) it surfaces all six documented
 * filter categories, including the four genuinely unavailable ones,
 * each with a real, traceable reason instead of omitting them
 * silently — see `recommendationTaxonomy.ts`'s own
 * `UNAVAILABLE_FILTER_REASONS`; (3) it adds a full Detail Panel, Action
 * Links, and Acknowledgement, none of which the Dashboard summary has
 * at all.
 *
 * **Recalculation (M7-036)**: this Store performs no triggering of its
 * own — `recalculate` is a plain, idempotent function of its
 * `(portfolio, targetHealthFactor)` arguments, exactly matching
 * `calculateTargetHealthFactorActions`'s own purity. `app/recommendations/page.tsx`
 * calls it from a `useEffect` keyed on `[activePortfolioId, portfolio.updatedAt]`
 * — `stores/portfolioStore.ts`'s own `update()` action already bumps
 * `portfolio.updatedAt` on every successful edit to collateral, debt,
 * market price, or protocol parameters (interest rate included) in one
 * shared code path, and `activePortfolioId` itself changes on a
 * portfolio switch — together these cover all five of M7-036's own
 * named triggers ("Market price update," "Portfolio position update,"
 * "Protocol parameter update," "Interest-rate update," "Active
 * portfolio switch") with one dependency pair, and the effect does not
 * re-fire on unrelated re-renders — satisfying "Avoid unnecessary
 * duplicate calculations" without adding a second, Store-level
 * memoization layer on top of an already-cheap pure function call.
 *
 * **Acknowledgement (M7-035)**: keyed per `(portfolioId, itemId)`, not
 * a global dismiss. Acknowledging an item stores a snapshot of its
 * current `relevantValues`; every successful `recalculate` for that same
 * portfolio compares the freshly computed `relevantValues` against the
 * stored snapshot and drops the acknowledgement the moment any value
 * differs — "a recommendation must return if its triggering condition
 * materially changes," read literally as "the numbers behind it changed
 * at all," the most conservative available interpretation (no numeric
 * tolerance invented). Acknowledging never deletes a recommendation from
 * the Store's own data — `app/recommendations/page.tsx` still renders
 * acknowledged items in a separate, visible "Acknowledged" section
 * rather than hiding them outright, a second, independent safeguard
 * against "must not hide critical risk changes permanently" beyond the
 * automatic-return mechanism itself.
 */
export type RecommendationItemId = 'repayment' | 'additionalCollateral';

export type RecommendationCenterStatus = 'idle' | 'noTarget' | 'ready' | 'error';

/**
 * The six documented filter categories (M7-032 "Filter by"), defined
 * here — not in `features/recommendations/` — matching
 * `stores/exitPlannerStore.ts`'s own `ExitPlannerType` precedent: a
 * Store-owned selection type the feature layer imports, not the reverse
 * (Stores never import from `features/`, per this codebase's established
 * dependency direction). `features/recommendations/utils/recommendationTaxonomy.ts`
 * owns the *display* mapping (labels, severity grouping, unavailable
 * reasons) built on top of this type.
 */
export type RecommendationFilterCategory =
  'safety' | 'debt' | 'collateral' | 'interest' | 'leverage' | 'exitReadiness';

type AcknowledgementsByPortfolio = Record<
  string,
  Partial<Record<RecommendationItemId, Record<string, number>>>
>;

export interface RecommendationCenterState {
  status: RecommendationCenterStatus;
  portfolioId: string | null;
  targetHealthFactor: number | null;
  actions: TargetHealthFactorActions | null;
  errors: ApplicationError[];
  lastMetadata: ServiceMetadata | null;
  categoryFilter: RecommendationFilterCategory | 'all';
  selectedItemId: RecommendationItemId | null;
  acknowledgements: AcknowledgementsByPortfolio;
}

export interface RecommendationCenterActions {
  recalculate: (portfolio: Portfolio) => void;
  setCategoryFilter: (filter: RecommendationFilterCategory | 'all') => void;
  selectItem: (id: RecommendationItemId | null) => void;
  acknowledge: (id: RecommendationItemId) => void;
  unacknowledge: (id: RecommendationItemId) => void;
}

/** Matches `stores/portfolioStore.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

// Written as a generic Record<string, number> comparator, but in
// practice `a`/`b` are always `TargetHealthFactorActions[id].relevantValues`
// for the same `id` at two different points in time — `calculateRepaymentRecommendation`
// (F-062) and `calculateAdditionalCollateralRecommendation` (F-063) each
// always produce the exact same fixed five-key shape (see
// recommendationTaxonomy.test.ts's own exhaustive key-set assertions),
// so the length mismatch this function guards against never actually
// occurs. Kept general rather than assuming the shapes always match, the
// same defense-in-depth precedent as this file's own `snapshot === undefined` guard below.
function relevantValuesEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function reconcileAcknowledgements(
  acknowledgements: AcknowledgementsByPortfolio,
  portfolioId: string,
  actions: TargetHealthFactorActions,
): AcknowledgementsByPortfolio {
  const existing = acknowledgements[portfolioId];
  if (existing === undefined) return acknowledgements;

  const next: Partial<Record<RecommendationItemId, Record<string, number>>> = {};
  (Object.keys(existing) as RecommendationItemId[]).forEach((id) => {
    // `snapshot === undefined` is unreachable — `id` is drawn from
    // `Object.keys(existing)` itself, so `existing[id]` is always the
    // real snapshot that made the key present; `acknowledge`/`unacknowledge`
    // never leave a key set to an `undefined` value (the latter deletes
    // the key outright). `Partial<Record<...>>`'s own index signature
    // types every access as possibly-`undefined` regardless.
    const snapshot = existing[id];
    if (snapshot === undefined) return;
    if (relevantValuesEqual(snapshot, actions[id].relevantValues)) {
      next[id] = snapshot;
    }
  });

  return { ...acknowledgements, [portfolioId]: next };
}

export const useRecommendationCenterStore = create<
  RecommendationCenterState & RecommendationCenterActions
>((set, get) => ({
  status: 'idle',
  portfolioId: null,
  targetHealthFactor: null,
  actions: null,
  errors: [],
  lastMetadata: null,
  categoryFilter: 'all',
  selectedItemId: null,
  acknowledgements: {},

  recalculate: (portfolio) => {
    const target = portfolio.settings.safetyTargets?.targetHealthFactor ?? null;
    const portfolioChanged = get().portfolioId !== portfolio.id;

    if (target === null) {
      set({
        status: 'noTarget',
        portfolioId: portfolio.id,
        targetHealthFactor: null,
        actions: null,
        errors: [],
        lastMetadata: null,
        selectedItemId: portfolioChanged ? null : get().selectedItemId,
      });
      return;
    }

    const result = calculateTargetHealthFactorActions(portfolio, target, SOURCE_STATUS);

    if (!result.ok) {
      set({
        status: 'error',
        portfolioId: portfolio.id,
        targetHealthFactor: target,
        actions: null,
        errors: result.errors,
        lastMetadata: result.metadata,
        selectedItemId: portfolioChanged ? null : get().selectedItemId,
      });
      return;
    }

    set((state) => ({
      status: 'ready',
      portfolioId: portfolio.id,
      targetHealthFactor: target,
      actions: result.data,
      errors: [],
      lastMetadata: result.metadata,
      selectedItemId: portfolioChanged ? null : state.selectedItemId,
      acknowledgements: reconcileAcknowledgements(
        state.acknowledgements,
        portfolio.id,
        result.data,
      ),
    }));
  },

  setCategoryFilter: (filter) => set({ categoryFilter: filter }),

  selectItem: (id) => set({ selectedItemId: id }),

  acknowledge: (id) => {
    const { portfolioId, actions } = get();
    if (portfolioId === null || actions === null) return;
    set((state) => ({
      acknowledgements: {
        ...state.acknowledgements,
        [portfolioId]: {
          ...state.acknowledgements[portfolioId],
          [id]: { ...actions[id].relevantValues },
        },
      },
    }));
  },

  unacknowledge: (id) => {
    const { portfolioId } = get();
    if (portfolioId === null) return;
    set((state) => {
      const existing = state.acknowledgements[portfolioId];
      if (existing === undefined || existing[id] === undefined) return state;
      const next = { ...existing };
      delete next[id];
      return { acknowledgements: { ...state.acknowledgements, [portfolioId]: next } };
    });
  },
}));
