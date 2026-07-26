/**
 * Portfolio Store — 06_TASKS.md M4-003 ("Implement Portfolio Store"):
 * "Create the Zustand portfolio store." Dependencies: M4-001, M3-005.
 * DoD: "Store actions remain focused on state transitions and delegate
 * calculations and persistence to Services."
 *
 * **Conflict B (approved, Milestone 4 plan): no interim persistence
 * infrastructure, no Zustand `persist` middleware, before Milestone 8.**
 * This store is in-memory only — a page refresh loses every portfolio.
 * Fields this task's own "State" list requires that presuppose a working
 * persistence backend are present (so the shape this task asks for
 * exists) but are honestly degenerate rather than backed by an interim
 * mechanism:
 * - `loadStatus` — `load()` has nothing to load from (no persistence
 *   layer exists), so it is a structural stub: it transitions
 *   `'loading'` → `'idle'` synchronously without changing `portfolios`.
 *   Where a real `services/persistence` call will go once Milestone 8
 *   builds one.
 * - `saveStatus` — every mutation is a synchronous in-memory write with
 *   no external save target. **Updated in Batch 8 (M4-013)**: every
 *   mutating action now transitions `'saving'` → `'saved'`/`'error'` for
 *   real (see this file's own M4-013 note below) — `'saved'` correctly
 *   means "committed to the Store's in-memory state," not "written to
 *   disk/cloud," which stays honest under Conflict B without claiming
 *   durability that doesn't exist. `'offline'` remains permanently
 *   unreachable — see the M4-013 note for why building it would be
 *   actively misleading, not merely unbuilt.
 * - `lastSynchronizedAt` — stays `null` always; there is no
 *   synchronization target yet (that is Milestone 8's cloud layer).
 *
 * This also means M4-010's "Retain selection after refresh" cannot be
 * genuinely satisfied by this batch — documented here and in
 * PROJECT_STATUS.md rather than papered over with an interim solution,
 * per instruction.
 *
 * **`calculatePortfolioSummary` (M3-005) usage — the concrete reason
 * this task depends on it**: M4-004 (Portfolio List Page, a later batch)
 * needs Net Equity/Health Factor/Debt for every portfolio in the list.
 * Rather than have the list page recompute this itself (duplicating a
 * calculation the Store is already positioned to own), `create`/
 * `update`/`duplicate` compute and cache each portfolio's
 * `ServiceResult<PortfolioSummary>` alongside its raw record — the
 * concrete meaning of "delegate calculations... to Services" here.
 *
 * **`sourceStatus` is hardcoded to `'manual'`**: M4 has no live
 * market-data wiring yet (Market Data Service, M3-007, is built, but the
 * Manual Price Controls / Protocol Configuration Controls tasks that
 * would supply a real `sourceStatus` are M4-014/M4-015, later batches).
 * Every portfolio in this batch is necessarily manually entered, so
 * `'manual'` is the honest current value, not a guess — revisit when
 * M4-014/M4-015 land.
 *
 * **Validation**: `create`/`update` run their input through
 * `portfolioInputSchema`/`portfolioInputUpdateSchema` (M4-002) before
 * constructing or mutating a `Portfolio` record — the concrete mechanism
 * behind M4-002's own DoD ("Invalid portfolio data is rejected before
 * reaching Services or persistence"). Zod issues are mapped to
 * `ApplicationError` (category `'validation'`, M3-003) and written to
 * `errors`, reusing the existing shared error contract rather than
 * inventing a parallel one. `MappingResult<Portfolio>` (M3-004/M3-007)
 * is reused as the return shape for `create`/`update`/`duplicate`: these
 * operations may fail before any Engine calculation ever runs (a Zod
 * validation failure), so they are not `ServiceResult`-shaped
 * operations — the same distinction that motivated `MappingResult` in
 * the first place.
 *
 * **`duplicate`/`archive` implement a minimal, correct version of what
 * M4-011/M4-012 (later, dedicated batches) will refine**: this task's
 * own "Actions" list requires both to exist now. `duplicate` generates a
 * new identity, copies positions/settings, and appends " (Copy)" to the
 * name — the same behavior M4-011's own text later names explicitly
 * ("Generate a new identity... Append a clear copy name"), implemented
 * here because M4-003 already requires *some* working `duplicate`
 * action, not because M4-011 is being started early. `archive` sets
 * `archivedAt`; M4-012's own confirmation/explanation UX is not built
 * here.
 *
 * **`archive` also clears `activePortfolioId` when archiving the active
 * portfolio (added in M4-012)**: M4-012's own text requires archiving to
 * "Hide from active lists" — if the archived record stayed selected, the
 * Portfolio page would keep showing a hidden portfolio as the primary
 * active view, contradicting "hidden". Mirrors `delete`'s existing
 * identical fallback (`activePortfolioId` -> `null`), which the Portfolio
 * page (`app/portfolio/page.tsx`) already renders gracefully as "No
 * portfolio is currently selected."
 *
 * **`unarchive` (added in M4-012)**: M4-012 documents Archive as
 * "retaining data" (as distinct from Delete, which has no such language)
 * and its own DoD requires archive/delete actions to be "recoverable
 * where documented" — read as: Archive's documented data retention must
 * be reachable by the user, not merely true internally to the Store.
 * `unarchive` is the direct, symmetric inverse of `archive` (sets
 * `archivedAt` back to `null`); it is not a new business rule, only the
 * necessary counterpart to the one M4-012 itself already names.
 *
 * **`update` now bumps `marketUpdatedAt`/`protocolUpdatedAt` (added in
 * M4-014/M4-015)**: M4-014 names "Timestamp" and M4-015 names "Freshness
 * status" as required display items, but neither the Engine's
 * `MarketPrices`/`ProtocolParameters` types nor this Store previously
 * tracked when either was last set — see `types/portfolio.ts`'s own
 * header comment for the field-level reasoning. `update` compares the
 * merged, revalidated `market`/`protocol` against the existing record
 * field-by-field (`marketPricesEqual`/`protocolParametersEqual`) and only
 * bumps the corresponding timestamp when the value actually changed —
 * editing the portfolio name, for instance, must not make the price look
 * freshly re-entered. `create` sets both to the creation timestamp (a
 * portfolio's initial price/protocol values are exactly as fresh as the
 * portfolio itself); `duplicate`/`archive`/`unarchive` all pass them
 * through unchanged via `...existing.portfolio`, since none of those
 * operations changes the price or protocol values themselves.
 *
 * **`saveStatus` transitions (added in M4-013, "Implement Portfolio
 * Auto-Save")** — every mutating action (`create`/`update`/`duplicate`/
 * `archive`/`unarchive`/`delete`) now sets `'saving'` before doing its
 * work, then `'saved'` on success or `'error'` on a validation/not-found
 * failure. `select`/`load` leave it untouched — neither persists
 * anything. Three of M4-013's four DoD-named states are genuinely
 * reachable this way; the fourth (`'offline'`) is not, and building it
 * anyway would misrepresent this app's actual behavior — see
 * PROJECT_STATUS.md's conflict #28 for the full reasoning:
 * - **`'saving'` is real but not paintable.** Every mutation here is a
 *   synchronous in-memory write — there is no I/O to await, so
 *   `'saving'` is set and then immediately overwritten by `'saved'`/
 *   `'error'` within the same synchronous call, before React ever gets a
 *   chance to render the intermediate value. It is still implemented as
 *   a real, distinct `set()` call (verifiable via direct
 *   `usePortfolioStore.subscribe`, not just `getState()` after the
 *   fact) rather than skipped, because the state machine itself should
 *   be complete and correct — but no `setTimeout`/artificial delay was
 *   added to make it visibly renderable, since that would fabricate
 *   latency this in-memory Store does not have.
 * - **`'offline'` is not wired to `navigator.onLine`.** Doing so would be
 *   real code with a false meaning: this Store makes zero network
 *   requests, so nothing about its behavior actually depends on
 *   connectivity — implying otherwise (e.g. "your changes aren't saved
 *   because you're offline") would be inventing a failure mode that
 *   cannot occur here, not merely leaving one unbuilt.
 * - **No "Retry transient failures" mechanism was added.** The only
 *   failure mode this Store has is Zod validation (deterministic, not
 *   transient) — resubmitting identical invalid input fails identically
 *   every time. The correct response is fixing the input, which the
 *   existing inline field-level errors (M4-002/M4-006/M4-007/M4-008)
 *   already support; a "Retry" button here would either be a no-op or
 *   silently misleading.
 *
 * **"Prevent stale updates from overwriting newer state" — already
 * structurally guaranteed at the Store layer, verified rather than
 * assumed.** Every action reads `get().portfolios[id]` fresh at call
 * time (not from a stale closure) and JS's single-threaded execution
 * means no two `set()`/`get()` calls can interleave — there is no window
 * in which an older write could land after, and overwrite, a newer one.
 * See `app/portfolio/page.tsx`'s own M4-013 note for the one genuinely
 * *reachable* staleness gap this batch found and fixed — a stale
 * *preview* (UI-local state), not a stale Store write.
 */
import type { ZodError } from 'zod';
import { create } from 'zustand';

import {
  type ApplicationError,
  calculatePortfolioSummary,
  createApplicationError,
  type MappingResult,
  type PortfolioSummary,
  type ServiceResult,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';
import {
  type PortfolioInput,
  portfolioInputSchema,
  type PortfolioInputUpdate,
  portfolioInputUpdateSchema,
} from '@/types/portfolio.schema';

const SOURCE_STATUS = 'manual';

export type PortfolioLoadStatus = 'idle' | 'loading' | 'error';
export type PortfolioSaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export interface PortfolioRecord {
  portfolio: Portfolio;
  summary: ServiceResult<PortfolioSummary>;
}

export interface PortfolioStoreState {
  portfolios: Record<string, PortfolioRecord>;
  activePortfolioId: string | null;
  loadStatus: PortfolioLoadStatus;
  saveStatus: PortfolioSaveStatus;
  errors: ApplicationError[];
  lastSynchronizedAt: string | null;
}

export interface PortfolioStoreActions {
  load: () => void;
  create: (input: unknown) => MappingResult<Portfolio>;
  update: (id: string, input: unknown) => MappingResult<Portfolio>;
  select: (id: string | null) => void;
  duplicate: (id: string) => MappingResult<Portfolio>;
  archive: (id: string) => void;
  unarchive: (id: string) => void;
  delete: (id: string) => void;
}

export type PortfolioStore = PortfolioStoreState & PortfolioStoreActions;

function zodErrorToErrors(error: ZodError): ApplicationError[] {
  return error.issues.map((issue) =>
    createApplicationError(
      'validation',
      `PORTFOLIO_INPUT_${issue.path.join('_').toUpperCase() || 'INVALID'}`,
      issue.message,
    ),
  );
}

function buildSummary(portfolio: Portfolio): ServiceResult<PortfolioSummary> {
  return calculatePortfolioSummary(portfolio, SOURCE_STATUS);
}

function notFoundError(id: string): ApplicationError {
  return createApplicationError(
    'validation',
    'PORTFOLIO_NOT_FOUND',
    `No portfolio exists with id "${id}".`,
  );
}

/** Field-by-field, not `JSON.stringify` — small flat objects, no key-order risk either way. */
function marketPricesEqual(a: Portfolio['market'], b: Portfolio['market']): boolean {
  return a.btcPriceUsd === b.btcPriceUsd;
}

function protocolParametersEqual(a: Portfolio['protocol'], b: Portfolio['protocol']): boolean {
  return (
    a.maxLoanToValue === b.maxLoanToValue &&
    a.liquidationThreshold === b.liquidationThreshold &&
    a.borrowApr === b.borrowApr &&
    a.supplyApr === b.supplyApr
  );
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle',
  saveStatus: 'idle',
  errors: [],
  lastSynchronizedAt: null,

  load: () => {
    // No persistence layer exists yet (Conflict B) — nothing to load.
    // This transition exists so the action is real and callable, ready
    // for Milestone 8 to give it something to do.
    set({ loadStatus: 'loading' });
    set({ loadStatus: 'idle' });
  },

  create: (input) => {
    set({ saveStatus: 'saving' });

    const parsed = portfolioInputSchema.safeParse(input);
    if (!parsed.success) {
      const errors = zodErrorToErrors(parsed.error);
      set({ errors, saveStatus: 'error' });
      return { ok: false, errors };
    }

    const now = new Date().toISOString();
    const data: PortfolioInput = parsed.data;
    const portfolio: Portfolio = {
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      baseCurrency: data.baseCurrency,
      collateral: data.collateral,
      debt: data.debt,
      market: data.market,
      protocol: data.protocol,
      settings: data.settings,
      archivedAt: null,
      marketUpdatedAt: now,
      protocolUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      portfolios: {
        ...state.portfolios,
        [portfolio.id]: { portfolio, summary: buildSummary(portfolio) },
      },
      errors: [],
      saveStatus: 'saved',
    }));

    return { ok: true, data: portfolio };
  },

  update: (id, input) => {
    set({ saveStatus: 'saving' });

    const existing = get().portfolios[id];
    if (existing === undefined) {
      const errors = [notFoundError(id)];
      set({ errors, saveStatus: 'error' });
      return { ok: false, errors };
    }

    const parsed = portfolioInputUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const errors = zodErrorToErrors(parsed.error);
      set({ errors, saveStatus: 'error' });
      return { ok: false, errors };
    }

    const update: PortfolioInputUpdate = parsed.data;
    const merged = {
      name: update.name ?? existing.portfolio.name,
      description: update.description ?? existing.portfolio.description,
      baseCurrency: update.baseCurrency ?? existing.portfolio.baseCurrency,
      collateral: update.collateral ?? existing.portfolio.collateral,
      debt: update.debt ?? existing.portfolio.debt,
      market: update.market ?? existing.portfolio.market,
      protocol: update.protocol ?? existing.portfolio.protocol,
      settings: update.settings ?? existing.portfolio.settings,
    };

    // Re-validate the fully merged result so a partial update cannot
    // produce an overall-invalid portfolio (e.g. a protocol-only change
    // that breaks the maxLoanToValue <= liquidationThreshold invariant).
    const revalidated = portfolioInputSchema.safeParse(merged);
    if (!revalidated.success) {
      const errors = zodErrorToErrors(revalidated.error);
      set({ errors, saveStatus: 'error' });
      return { ok: false, errors };
    }

    const now = new Date().toISOString();
    const marketChanged = !marketPricesEqual(revalidated.data.market, existing.portfolio.market);
    const protocolChanged = !protocolParametersEqual(
      revalidated.data.protocol,
      existing.portfolio.protocol,
    );

    const portfolio: Portfolio = {
      ...existing.portfolio,
      ...revalidated.data,
      marketUpdatedAt: marketChanged ? now : existing.portfolio.marketUpdatedAt,
      protocolUpdatedAt: protocolChanged ? now : existing.portfolio.protocolUpdatedAt,
      updatedAt: now,
    };

    set((state) => ({
      portfolios: {
        ...state.portfolios,
        [id]: { portfolio, summary: buildSummary(portfolio) },
      },
      errors: [],
      saveStatus: 'saved',
    }));

    return { ok: true, data: portfolio };
  },

  select: (id) => {
    if (id !== null && get().portfolios[id] === undefined) {
      set({ errors: [notFoundError(id)] });
      return;
    }
    set({ activePortfolioId: id, errors: [] });
  },

  duplicate: (id) => {
    set({ saveStatus: 'saving' });

    const existing = get().portfolios[id];
    if (existing === undefined) {
      const errors = [notFoundError(id)];
      set({ errors, saveStatus: 'error' });
      return { ok: false, errors };
    }

    const now = new Date().toISOString();
    const portfolio: Portfolio = {
      ...existing.portfolio,
      id: crypto.randomUUID(),
      name: `${existing.portfolio.name} (Copy)`,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      portfolios: {
        ...state.portfolios,
        [portfolio.id]: { portfolio, summary: buildSummary(portfolio) },
      },
      errors: [],
      saveStatus: 'saved',
    }));

    return { ok: true, data: portfolio };
  },

  archive: (id) => {
    set({ saveStatus: 'saving' });

    const existing = get().portfolios[id];
    if (existing === undefined) {
      set({ errors: [notFoundError(id)], saveStatus: 'error' });
      return;
    }
    const portfolio: Portfolio = {
      ...existing.portfolio,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      portfolios: { ...state.portfolios, [id]: { portfolio, summary: buildSummary(portfolio) } },
      activePortfolioId: state.activePortfolioId === id ? null : state.activePortfolioId,
      errors: [],
      saveStatus: 'saved',
    }));
  },

  unarchive: (id) => {
    set({ saveStatus: 'saving' });

    const existing = get().portfolios[id];
    if (existing === undefined) {
      set({ errors: [notFoundError(id)], saveStatus: 'error' });
      return;
    }
    const portfolio: Portfolio = {
      ...existing.portfolio,
      archivedAt: null,
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      portfolios: { ...state.portfolios, [id]: { portfolio, summary: buildSummary(portfolio) } },
      errors: [],
      saveStatus: 'saved',
    }));
  },

  delete: (id) => {
    set({ saveStatus: 'saving' });

    if (get().portfolios[id] === undefined) {
      set({ errors: [notFoundError(id)], saveStatus: 'error' });
      return;
    }
    set((state) => {
      const portfolios = { ...state.portfolios };
      delete portfolios[id];
      return {
        portfolios,
        activePortfolioId: state.activePortfolioId === id ? null : state.activePortfolioId,
        errors: [],
        saveStatus: 'saved',
      };
    });
  },
}));
