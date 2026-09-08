import { create } from 'zustand';

import {
  type ApplicationError,
  autoSaveCoordinator,
  calculateRecommendationActions,
  persistenceService,
  type Recommendation,
  type ServiceMetadata,
  SINGLETON_RECORD_ID,
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
 * **v1.18.0 Batch 3** (`docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md`
 * §6.3) — this Store now calls `calculateRecommendationActions`
 * (Batch 2, `services/recommendation/recommendationActions.ts`) instead
 * of `calculateTargetHealthFactorActions`. That Service resolves
 * Conflict #29's sourcing gap itself: it always computes Repayment/
 * Additional Collateral once a target Health Factor exists (unchanged
 * behavior), and independently computes Borrow/Loop whenever this
 * portfolio's own `settings.recommendationPreferences` has that rule's
 * complete field pair (Batch 1) — never all-or-nothing, never a silent
 * default. This Store still does not call `generateRecommendationSet`
 * (M3-012) — that Service's `RecommendationRuleConfig` remains a single
 * non-optional object requiring all seven fields at once, which is not
 * what `calculateRecommendationActions` is (see that file's own header
 * comment for why it composes the Engine rules directly instead). The
 * Dashboard's own `buildRecommendationSummary.ts` still calls
 * `calculateTargetHealthFactorActions` directly, unchanged by this batch
 * (spec §9) — this Recommendation Center still reviews "more... than the
 * Dashboard summary displays" (M7-031's own DoD) the same three ways as
 * before, now joined by a fourth: it can also surface Borrow/Loop, which
 * the Dashboard summary never will.
 *
 * **Recalculation (M7-036)**: this Store performs no triggering of its
 * own — `recalculate` is a plain, idempotent function of its one
 * `portfolio` argument, exactly matching `calculateRecommendationActions`'s
 * own purity (it reads `targetHealthFactor`/`recommendationPreferences`
 * directly off the portfolio itself — Batch 3 no longer extracts
 * `targetHealthFactor` here before calling the Service, since the new
 * Service does that internally). `app/recommendations/page.tsx`
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
/**
 * v1.18.0 Batch 3 — extended from `'repayment' | 'additionalCollateral'`
 * to include `'borrow'`/`'loop'`, matching
 * `services/recommendation/recommendationActions.ts`'s own identical
 * union (Batch 2). Kept as its own, separately declared type here rather
 * than imported from that Service file — the same "Store-owned selection
 * type" precedent this type already followed before this batch, and the
 * same layering direction `services/recommendation/recommendationActions.ts`'s
 * own header comment documents for why it does not import `Portfolio`
 * concepts the other way.
 */
export type RecommendationItemId = 'repayment' | 'additionalCollateral' | 'borrow' | 'loop';

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

export type AcknowledgementsByPortfolio = Record<
  string,
  Partial<Record<RecommendationItemId, Record<string, number>>>
>;

/**
 * v1.18.0 Batch 3 — `actions` changes shape from the old
 * `TargetHealthFactorActions` (a fixed, non-optional two-key object) to
 * `Partial<Record<RecommendationItemId, Recommendation>>`, matching
 * `calculateRecommendationActions`'s own `RecommendationActionsResult.items`
 * (Batch 2): `repayment`/`additionalCollateral` are present whenever
 * `status === 'ready'` (unchanged in practice), `borrow`/`loop` are
 * present only when this portfolio's own preferences make them so.
 * `unavailableReasons` is new — a real, sourced reason for every item not
 * in `actions`, keyed the same way, so `RecommendationList`/
 * `RecommendationDetailPanel` can explain a missing `borrow`/`loop` item
 * without inventing a message of their own (spec §8).
 */
export interface RecommendationCenterState {
  status: RecommendationCenterStatus;
  portfolioId: string | null;
  targetHealthFactor: number | null;
  actions: Partial<Record<RecommendationItemId, Recommendation>> | null;
  unavailableReasons: Partial<Record<RecommendationItemId, string>>;
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
  loadAcknowledgements: () => Promise<void>;
}

function scheduleAcknowledgementsSave(acknowledgements: AcknowledgementsByPortfolio): void {
  autoSaveCoordinator.schedule(
    'recommendationAcknowledgements',
    SINGLETON_RECORD_ID,
    acknowledgements,
  );
}

/** Matches `stores/portfolioStore.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

// Written as a generic Record<string, number> comparator, but in
// practice `a`/`b` are always the same item's `relevantValues` at two
// different points in time — `calculateRepaymentRecommendation` (F-062),
// `calculateAdditionalCollateralRecommendation` (F-063),
// `calculateBorrowRecommendation` (F-061), and `calculateLoopRecommendation`
// (F-064) each always produce the exact same fixed key shape for a given
// item (see recommendationTaxonomy.test.ts's own exhaustive key-set
// assertions), so the length mismatch this function guards against never
// actually occurs. Kept general rather than assuming the shapes always
// match, the same defense-in-depth precedent as this file's own
// `snapshot === undefined` guard below.
function relevantValuesEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

/**
 * v1.18.0 Batch 3 — `actions` is now `Partial<Record<...>>` (Borrow/Loop
 * may be absent). An acknowledgement whose item is no longer present in
 * `actions` (its preferences were changed or removed since acknowledging)
 * is dropped, not preserved — there is no `relevantValues` left to
 * compare it against, and an unavailable item is never rendered as
 * acknowledged/unacknowledged anyway (`RecommendationList.tsx` only ever
 * lists items present in `actions`).
 */
function reconcileAcknowledgements(
  acknowledgements: AcknowledgementsByPortfolio,
  portfolioId: string,
  actions: Partial<Record<RecommendationItemId, Recommendation>>,
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
    const recommendation = actions[id];
    if (recommendation === undefined) return;
    if (relevantValuesEqual(snapshot, recommendation.relevantValues)) {
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
  unavailableReasons: {},
  errors: [],
  lastMetadata: null,
  categoryFilter: 'all',
  selectedItemId: null,
  acknowledgements: {},

  recalculate: (portfolio) => {
    const portfolioChanged = get().portfolioId !== portfolio.id;
    const result = calculateRecommendationActions(portfolio, SOURCE_STATUS);

    if (!result.ok) {
      // `actions` preserves the last valid recommendations when
      // recalculating the *same* portfolio (M7-038 "Restore last valid
      // result") — the same `portfolioChanged` guard `selectedItemId`
      // already uses. Only nulled on a genuine portfolio *switch* to a
      // different, already-broken portfolio, where a stale result from a
      // different portfolio would be misleading rather than useful.
      set({
        status: 'error',
        portfolioId: portfolio.id,
        targetHealthFactor: portfolioChanged ? null : get().targetHealthFactor,
        actions: portfolioChanged ? null : get().actions,
        unavailableReasons: portfolioChanged ? {} : get().unavailableReasons,
        errors: result.errors,
        lastMetadata: result.metadata,
        selectedItemId: portfolioChanged ? null : get().selectedItemId,
      });
      return;
    }

    // Spec §6.1 step 1 — no target Health Factor configured. Matches
    // today's exact `'noTarget'` short-circuit UI (`RecommendationList.tsx`
    // returns early on this status before ever reading `actions`/
    // `unavailableReasons`, so their exact values here don't affect what
    // renders; kept structurally consistent regardless).
    if (result.data.targetHealthFactor === null) {
      set({
        status: 'noTarget',
        portfolioId: portfolio.id,
        targetHealthFactor: null,
        actions: null,
        unavailableReasons: result.data.unavailableReasons,
        errors: [],
        lastMetadata: result.metadata,
        selectedItemId: portfolioChanged ? null : get().selectedItemId,
      });
      return;
    }

    set((state) => {
      const reconciled = reconcileAcknowledgements(
        state.acknowledgements,
        portfolio.id,
        result.data.items,
      );
      if (reconciled !== state.acknowledgements) {
        scheduleAcknowledgementsSave(reconciled);
      }
      return {
        status: 'ready',
        portfolioId: portfolio.id,
        targetHealthFactor: result.data.targetHealthFactor,
        actions: result.data.items,
        unavailableReasons: result.data.unavailableReasons,
        errors: [],
        lastMetadata: result.metadata,
        selectedItemId: portfolioChanged ? null : state.selectedItemId,
        acknowledgements: reconciled,
      };
    });
  },

  setCategoryFilter: (filter) => set({ categoryFilter: filter }),

  selectItem: (id) => set({ selectedItemId: id }),

  acknowledge: (id) => {
    const { portfolioId, actions } = get();
    const recommendation = actions?.[id];
    if (portfolioId === null || recommendation === undefined) return;
    set((state) => {
      const acknowledgements = {
        ...state.acknowledgements,
        [portfolioId]: {
          ...state.acknowledgements[portfolioId],
          [id]: { ...recommendation.relevantValues },
        },
      };
      scheduleAcknowledgementsSave(acknowledgements);
      return { acknowledgements };
    });
  },

  unacknowledge: (id) => {
    const { portfolioId } = get();
    if (portfolioId === null) return;
    set((state) => {
      const existing = state.acknowledgements[portfolioId];
      if (existing === undefined || existing[id] === undefined) return state;
      const next = { ...existing };
      delete next[id];
      const acknowledgements = { ...state.acknowledgements, [portfolioId]: next };
      scheduleAcknowledgementsSave(acknowledgements);
      return { acknowledgements };
    });
  },

  loadAcknowledgements: async () => {
    await autoSaveCoordinator.flushAll();
    const result = await persistenceService.read<AcknowledgementsByPortfolio>(
      'recommendationAcknowledgements',
      SINGLETON_RECORD_ID,
    );
    if (!result.ok || result.data === null) return;
    set({ acknowledgements: result.data });
  },
}));
