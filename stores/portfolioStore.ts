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
 *   no external save target, so this never leaves `'idle'`. It does not
 *   report `'saved'`, since nothing is actually durable — that would
 *   misrepresent what happened. Real transitions ('saving', 'saved',
 *   'offline', 'failed') are M4-013's job, once there is something real
 *   to report on.
 * - `lastSynchronizedAt` — stays `null` always; there is no
 *   synchronization target yet (that is Milestone 8's cloud layer).
 *
 * This also means M4-010's "Retain selection after refresh" and
 * M4-013's auto-save behaviors cannot be genuinely satisfied by this
 * batch — documented here and in PROJECT_STATUS.md rather than papered
 * over with an interim solution, per instruction.
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
    const parsed = portfolioInputSchema.safeParse(input);
    if (!parsed.success) {
      const errors = zodErrorToErrors(parsed.error);
      set({ errors });
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
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      portfolios: {
        ...state.portfolios,
        [portfolio.id]: { portfolio, summary: buildSummary(portfolio) },
      },
      errors: [],
    }));

    return { ok: true, data: portfolio };
  },

  update: (id, input) => {
    const existing = get().portfolios[id];
    if (existing === undefined) {
      const errors = [notFoundError(id)];
      set({ errors });
      return { ok: false, errors };
    }

    const parsed = portfolioInputUpdateSchema.safeParse(input);
    if (!parsed.success) {
      const errors = zodErrorToErrors(parsed.error);
      set({ errors });
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
      set({ errors });
      return { ok: false, errors };
    }

    const portfolio: Portfolio = {
      ...existing.portfolio,
      ...revalidated.data,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      portfolios: {
        ...state.portfolios,
        [id]: { portfolio, summary: buildSummary(portfolio) },
      },
      errors: [],
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
    const existing = get().portfolios[id];
    if (existing === undefined) {
      const errors = [notFoundError(id)];
      set({ errors });
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
    }));

    return { ok: true, data: portfolio };
  },

  archive: (id) => {
    const existing = get().portfolios[id];
    if (existing === undefined) {
      set({ errors: [notFoundError(id)] });
      return;
    }
    const portfolio: Portfolio = {
      ...existing.portfolio,
      archivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({
      portfolios: { ...state.portfolios, [id]: { portfolio, summary: buildSummary(portfolio) } },
      errors: [],
    }));
  },

  delete: (id) => {
    if (get().portfolios[id] === undefined) {
      set({ errors: [notFoundError(id)] });
      return;
    }
    set((state) => {
      const portfolios = { ...state.portfolios };
      delete portfolios[id];
      return {
        portfolios,
        activePortfolioId: state.activePortfolioId === id ? null : state.activePortfolioId,
        errors: [],
      };
    });
  },
}));
