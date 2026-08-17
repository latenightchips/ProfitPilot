/**
 * Portfolio Store — 06_TASKS.md M4-003 ("Implement Portfolio Store"):
 * "Create the Zustand portfolio store." Dependencies: M4-001, M3-005.
 * DoD: "Store actions remain focused on state transitions and delegate
 * calculations and persistence to Services."
 *
 * **Conflict B (Milestone 4 plan) — resolved for local storage in
 * Milestone 8 Batch 2.** Every mutating action now schedules a real,
 * debounced write through `autoSaveCoordinator`/`persistenceService`
 * (`services/persistence`, M8-008/M8-011) — never `localStorage`
 * directly, per the standing architectural rule that only
 * `services/persistence/` may touch a storage adapter. `lastSynchronizedAt`
 * still stays `null` always: this is local persistence, not cloud
 * *synchronization* (Milestone 8's later Cloud Sync batch) — no
 * synchronization target exists yet.
 * - `load()` (M8-008) now really hydrates `portfolios` and
 *   `activePortfolioId` from local storage — see its own implementation
 *   comment below for why both reads happen even though the Store's
 *   public shape stayed a single action.
 * - `saveStatus` reflects `autoSaveCoordinator`'s real, asynchronous save
 *   state for the most recently mutated portfolio (not `select`'s own
 *   `'activePortfolio'` write — see `select`'s own comment) — `'saved'`
 *   now honestly means "written to local storage," and `'error'` is
 *   reachable for real (a local storage quota/availability failure), not
 *   merely modeled. `'offline'` remains permanently unreachable: this
 *   Store still makes zero network requests, so nothing about its
 *   behavior depends on connectivity.
 * - **"Retry transient failures"** is now real too, inside
 *   `autoSaveCoordinator` itself (M8-011) — this Store does not
 *   implement its own retry logic, it only reads the coordinator's
 *   resulting state.
 *
 * M4-010's "Retain selection after refresh" is now genuinely satisfied —
 * `load()` restores `activePortfolioId` from its own persisted record.
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
 * **`saveStatus` transitions (added in M4-013; made real in Milestone 8
 * Batch 2, M8-008/M8-011)** — every mutating action
 * (`create`/`update`/`duplicate`/`archive`/`unarchive`/`delete`) sets
 * `'saving'` synchronously (a real, immediately-visible `set()` call —
 * verifiable via `usePortfolioStore.subscribe`, not just a later
 * `getState()`), then asynchronously schedules a debounced local storage
 * write through `autoSaveCoordinator`. A module-level subscription below
 * this Store's own definition mirrors that coordinator's eventual
 * `'saved'`/`'error'` state back into `saveStatus` once the write
 * actually resolves — genuinely asynchronous now, so `'saving'` is
 * observable for real, not just structurally present. `select`/`load`
 * still leave `saveStatus` untouched: `load` hydrates rather than saves,
 * and `select`'s own `'activePortfolio'` write is a separate, silently
 * tracked record — see `select`'s own comment for why conflating the two
 * would misrepresent what `saveStatus` has always meant (the *portfolio*
 * record's own save state).
 * - **`'offline'` is still not wired to `navigator.onLine`.** Local
 *   storage access has no network dependency — a "you're offline" state
 *   would still be inventing a failure mode that cannot occur here.
 * - **"Retry transient failures" is now real**, inside
 *   `autoSaveCoordinator` itself (M8-011) — a `LOCAL_STORAGE_WRITE_FAILED`/
 *   `LOCAL_STORAGE_READ_FAILED` failure retries with backoff before
 *   settling into `'error'`; a Zod validation failure (still
 *   deterministic) is never even scheduled, since this Store only calls
 *   `autoSaveCoordinator.schedule` after a mutation already committed a
 *   valid record to memory.
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
 *
 * **`recomputeSummary` (added in M4-017, "Implement Portfolio Error
 * Recovery")** — the concrete mechanism behind that task's "Retry"
 * Include item for **calculation** failures. Unlike every other action
 * here, it changes no portfolio data at all — it only re-runs
 * `buildSummary` against the already-stored, already-Zod-valid
 * `portfolio` and re-caches the result. `calculatePortfolioSummary` can
 * genuinely fail for Zod-valid input — e.g. zero collateral with
 * nonzero debt, collateral value exactly equal to debt value, or a zero
 * liquidation threshold with nonzero debt all divide by zero at the
 * Engine layer (`calculateLoanToValue`/`calculateEffectiveLeverage`/
 * `calculateLiquidationPrice`) — so this is a real recomputation, not a
 * UI-only toggle. **Honestly, though, it cannot fix anything by
 * itself**: every other mutating action already recomputes and re-caches
 * the summary on every commit, so a cached summary is never stale
 * relative to the currently-stored portfolio — re-running the identical,
 * deterministic calculation against *unchanged* data reproduces the
 * identical failure every time (confirmed via test, not assumed). Its
 * value is matching 03_UI.md's explicit "Retry Button" ERROR RECOVERY
 * item, not a claim that clicking it resolves the underlying issue —
 * only fixing the position itself (via `update`, which already clears
 * the failure automatically once applied) does that. Does not touch
 * `saveStatus`: nothing is being saved, only re-derived from data that
 * was already saved.
 *
 * **`setProtocolVersion`/`setAaveV4Position` (V4 Readiness Audit §12
 * Stage 5)** — the Store mutations `services/portfolio/models.ts`'s own
 * `protocolVersion`/`v4Position` doc comments deferred to "whichever
 * later stage adds the actual Store mutation." Deliberately separate
 * from `create`/`update`/`portfolioInputSchema`, the same way live-synced
 * `market`/`protocol` bypass the main input form: neither field is
 * user-entered through the Portfolio creation/edit form (there is still
 * no UI for either — Stage 5's own non-goal), so there is nothing for
 * `portfolioInputSchema` to validate them against.
 *
 * `setAaveV4Position` returns `MappingResult<Portfolio>` like
 * `create`/`update`, because it runs real, failable validation
 * (`aaveV4PositionIdentitySchema` — Stage 4A's existing schema, reused
 * unchanged) against a value that could genuinely be malformed once a
 * real caller supplies one. `setProtocolVersion` returns `void` like
 * `archive`/`unarchive`, because `AaveProtocolVersion` is a closed TS
 * union with nothing Zod-parseable to fail on beyond the portfolio itself
 * not existing — the same distinction this file already draws between
 * `create`/`update` (return `MappingResult`) and `archive`/`unarchive`/
 * `delete`/`select` (return `void`, only ever failing on "not found").
 *
 * **Deliberately no cross-inference between the two fields.** Setting
 * `v4Position` does not set `protocolVersion` to `'v4'`, and setting
 * `protocolVersion` does not require or clear `v4Position` — whether a
 * portfolio actually *uses* a V4 identity for debt-math dispatch
 * (`services/simulation/scenario.ts`'s own `protocolVersion` read) is a
 * product/UX decision for whichever stage builds the real selector UI,
 * not a rule to bake silently into Store plumbing now. A portfolio can
 * therefore legally hold `v4Position` set while `protocolVersion` stays
 * `'v3'`/unset, or vice versa — both actions accept `undefined` to clear
 * their own field independently, with no side effect on the other.
 *
 * **`setAaveV4DebtState` (V4 Readiness Audit §12 Stage 6)** — same shape
 * and same reasoning as `setAaveV4Position`: returns
 * `MappingResult<Portfolio>` because `aaveV4DebtStateSchema` (Stage 6)
 * is real, failable validation, mirrors the `create`/`update`/
 * `setAaveV4Position` "saving" → validate → commit → schedule save
 * sequence exactly, and participates in the same no-cross-inference rule
 * — setting `v4DebtState` neither requires nor implies `protocolVersion`
 * or `v4Position`. `services/simulation/scenario.ts` does not read this
 * field yet (Stage 6 is data-model/persistence only; see
 * `AaveV4DebtState`'s own doc comment in `services/portfolio/models.ts`
 * for what wires it up later).
 *
 * **`aaveV4DebtStateEqual` (V4 Readiness Audit §12 Stage 7)** — exported
 * for `hooks/useAaveV4LiveSync.ts`, the same role
 * `marketPricesEqual`/`protocolParametersEqual` already play for
 * `hooks/useAaveLiveSync.ts`: that hook is `setAaveV4DebtState`'s first
 * production caller (Stage 6 only added the action itself), and this
 * equality check is what keeps a background sync from bumping
 * `updatedAt` — and therefore clearing an open Preview, same as the V3
 * equality gates — on a refresh that fetched identical values.
 */
import type { ZodError } from 'zod';
import { create } from 'zustand';

import {
  type AaveProtocolVersion,
  type AaveV4CollateralRiskConfig,
  type AaveV4DebtState,
  type AaveV4PositionIdentity,
  type ApplicationError,
  autoSaveCoordinator,
  calculatePortfolioSummary,
  createApplicationError,
  type MappingResult,
  type PersistedActivePortfolio,
  persistenceService,
  type PortfolioSummary,
  type ServiceResult,
  SINGLETON_RECORD_ID,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';
import {
  aaveV4CollateralRiskConfigSchema,
  aaveV4DebtStateSchema,
  aaveV4PositionIdentitySchema,
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
  load: () => Promise<void>;
  create: (input: unknown) => MappingResult<Portfolio>;
  update: (id: string, input: unknown) => MappingResult<Portfolio>;
  select: (id: string | null) => void;
  duplicate: (id: string) => MappingResult<Portfolio>;
  archive: (id: string) => void;
  unarchive: (id: string) => void;
  delete: (id: string) => void;
  recomputeSummary: (id: string) => void;
  setProtocolVersion: (id: string, version: AaveProtocolVersion | undefined) => void;
  setAaveV4Position: (
    id: string,
    v4Position: AaveV4PositionIdentity | undefined,
  ) => MappingResult<Portfolio>;
  setAaveV4DebtState: (
    id: string,
    v4DebtState: AaveV4DebtState | undefined,
  ) => MappingResult<Portfolio>;
  setAaveV4CollateralRisk: (
    id: string,
    v4CollateralRisk: AaveV4CollateralRiskConfig | undefined,
  ) => MappingResult<Portfolio>;
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

/**
 * Field-by-field, not `JSON.stringify` — small flat objects, no key-order
 * risk either way. Exported for reuse by `hooks/useAaveLiveSync.ts`'s
 * equality gate (Portfolio Live-State Cleanup batch) — the same "is this
 * actually a change" check this Store's own `update()` already relies on
 * to decide whether to bump `marketUpdatedAt`/`protocolUpdatedAt`.
 */
export function marketPricesEqual(a: Portfolio['market'], b: Portfolio['market']): boolean {
  return a.btcPriceUsd === b.btcPriceUsd;
}

export function protocolParametersEqual(
  a: Portfolio['protocol'],
  b: Portfolio['protocol'],
): boolean {
  return (
    a.maxLoanToValue === b.maxLoanToValue &&
    a.liquidationThreshold === b.liquidationThreshold &&
    a.borrowApr === b.borrowApr &&
    a.supplyApr === b.supplyApr
  );
}

/**
 * `aaveV4DebtStateEqual` (V4 Readiness Audit §12 Stage 7) — same
 * equality-gate role as `marketPricesEqual`/`protocolParametersEqual`
 * above, for `hooks/useAaveV4LiveSync.ts`'s own sync effect. Unlike
 * `market`/`protocol` (always-present fields), `v4DebtState` is
 * optional, so both "undefined" sides are handled explicitly rather than
 * assuming a caller already narrowed them.
 */
export function aaveV4DebtStateEqual(
  a: AaveV4DebtState | undefined,
  b: AaveV4DebtState | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.drawnDebt === b.drawnDebt &&
    a.premiumDebt === b.premiumDebt &&
    a.baseDrawnApr === b.baseDrawnApr &&
    a.riskPremium === b.riskPremium
  );
}

/**
 * The one portfolio id `saveStatus` currently tracks — updated by every
 * mutating action right before it schedules a save/delete, read by the
 * module-level `autoSaveCoordinator.subscribe` below. A plain module
 * variable, not Store state: it is an internal bookkeeping detail for
 * this one mirroring subscription, not something any component reads.
 */
let lastPersistedPortfolioId: string | null = null;

function schedulePortfolioSave(portfolio: Portfolio): void {
  lastPersistedPortfolioId = portfolio.id;
  autoSaveCoordinator.schedule('portfolio', portfolio.id, portfolio);
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle',
  saveStatus: 'idle',
  errors: [],
  lastSynchronizedAt: null,

  load: async () => {
    set({ loadStatus: 'loading' });

    // Flushes any still-debounced write (e.g. a `create` moments ago,
    // navigating straight into a fresh mount of a page that calls
    // `load()`) so this read never races an in-flight write and
    // overwrites a just-created in-memory record with stale disk
    // contents — see `autoSaveCoordinator.flushAll`'s own comment.
    await autoSaveCoordinator.flushAll();

    const portfoliosResult = await persistenceService.list<Portfolio>('portfolio');
    if (!portfoliosResult.ok) {
      set({ loadStatus: 'error', errors: portfoliosResult.errors });
      return;
    }

    // A second, independent read — 'activePortfolio' is its own record
    // (see this file's own top comment), not a field the portfolio list
    // read above already carries. A failure here is not fatal to loading
    // portfolios themselves: it just means no selection is restored.
    const activeResult = await persistenceService.read<PersistedActivePortfolio>(
      'activePortfolio',
      SINGLETON_RECORD_ID,
    );
    const activePortfolioId = activeResult.ok ? (activeResult.data?.portfolioId ?? null) : null;

    const portfolios: Record<string, PortfolioRecord> = {};
    for (const portfolio of portfoliosResult.data) {
      portfolios[portfolio.id] = { portfolio, summary: buildSummary(portfolio) };
    }

    set({
      portfolios,
      activePortfolioId:
        activePortfolioId !== null && portfolios[activePortfolioId] !== undefined
          ? activePortfolioId
          : null,
      loadStatus: 'idle',
      errors: [],
    });
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
    }));
    schedulePortfolioSave(portfolio);

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
    }));
    schedulePortfolioSave(portfolio);

    return { ok: true, data: portfolio };
  },

  select: (id) => {
    if (id !== null && get().portfolios[id] === undefined) {
      set({ errors: [notFoundError(id)] });
      return;
    }
    set({ activePortfolioId: id, errors: [] });
    // Deliberately does not touch `saveStatus` — that field has always
    // meant "the *portfolio* record's own save state" (M4-013); the
    // active-selection write below is a separate, silently tracked
    // record (`'activePortfolio'`), not a portfolio mutation.
    autoSaveCoordinator.schedule<PersistedActivePortfolio>('activePortfolio', SINGLETON_RECORD_ID, {
      portfolioId: id,
    });
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
    }));
    schedulePortfolioSave(portfolio);

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
    }));
    schedulePortfolioSave(portfolio);
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
    }));
    schedulePortfolioSave(portfolio);
  },

  delete: (id) => {
    set({ saveStatus: 'saving' });

    if (get().portfolios[id] === undefined) {
      set({ errors: [notFoundError(id)], saveStatus: 'error' });
      return;
    }
    lastPersistedPortfolioId = id;
    autoSaveCoordinator.scheduleDelete('portfolio', id);
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

  recomputeSummary: (id) => {
    const existing = get().portfolios[id];
    if (existing === undefined) {
      set({ errors: [notFoundError(id)] });
      return;
    }
    set((state) => ({
      portfolios: {
        ...state.portfolios,
        [id]: { portfolio: existing.portfolio, summary: buildSummary(existing.portfolio) },
      },
      errors: [],
    }));
  },

  setProtocolVersion: (id, version) => {
    set({ saveStatus: 'saving' });

    const existing = get().portfolios[id];
    if (existing === undefined) {
      set({ errors: [notFoundError(id)], saveStatus: 'error' });
      return;
    }

    const portfolio: Portfolio = {
      ...existing.portfolio,
      protocolVersion: version,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      portfolios: { ...state.portfolios, [id]: { portfolio, summary: buildSummary(portfolio) } },
      errors: [],
    }));
    schedulePortfolioSave(portfolio);
  },

  setAaveV4Position: (id, v4Position) => {
    set({ saveStatus: 'saving' });

    const existing = get().portfolios[id];
    if (existing === undefined) {
      const errors = [notFoundError(id)];
      set({ errors, saveStatus: 'error' });
      return { ok: false, errors };
    }

    let validated: AaveV4PositionIdentity | undefined;
    if (v4Position !== undefined) {
      const parsed = aaveV4PositionIdentitySchema.safeParse(v4Position);
      if (!parsed.success) {
        const errors = zodErrorToErrors(parsed.error);
        set({ errors, saveStatus: 'error' });
        return { ok: false, errors };
      }
      validated = {
        // Schema-validated against `^0x[0-9a-fA-F]{40}$` above, so this is
        // a safe narrowing, not an unchecked cast — same convention as
        // `services/aave/v4LivePosition.ts`.
        userAddress: parsed.data.userAddress as `0x${string}`,
      };
    }

    const portfolio: Portfolio = {
      ...existing.portfolio,
      v4Position: validated,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      portfolios: { ...state.portfolios, [id]: { portfolio, summary: buildSummary(portfolio) } },
      errors: [],
    }));
    schedulePortfolioSave(portfolio);

    return { ok: true, data: portfolio };
  },

  setAaveV4DebtState: (id, v4DebtState) => {
    set({ saveStatus: 'saving' });

    const existing = get().portfolios[id];
    if (existing === undefined) {
      const errors = [notFoundError(id)];
      set({ errors, saveStatus: 'error' });
      return { ok: false, errors };
    }

    let validated: AaveV4DebtState | undefined;
    if (v4DebtState !== undefined) {
      const parsed = aaveV4DebtStateSchema.safeParse(v4DebtState);
      if (!parsed.success) {
        const errors = zodErrorToErrors(parsed.error);
        set({ errors, saveStatus: 'error' });
        return { ok: false, errors };
      }
      validated = parsed.data;
    }

    const portfolio: Portfolio = {
      ...existing.portfolio,
      v4DebtState: validated,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      portfolios: { ...state.portfolios, [id]: { portfolio, summary: buildSummary(portfolio) } },
      errors: [],
    }));
    schedulePortfolioSave(portfolio);

    return { ok: true, data: portfolio };
  },

  setAaveV4CollateralRisk: (id, v4CollateralRisk) => {
    set({ saveStatus: 'saving' });

    const existing = get().portfolios[id];
    if (existing === undefined) {
      const errors = [notFoundError(id)];
      set({ errors, saveStatus: 'error' });
      return { ok: false, errors };
    }

    let validated: AaveV4CollateralRiskConfig | undefined;
    if (v4CollateralRisk !== undefined) {
      const parsed = aaveV4CollateralRiskConfigSchema.safeParse(v4CollateralRisk);
      if (!parsed.success) {
        const errors = zodErrorToErrors(parsed.error);
        set({ errors, saveStatus: 'error' });
        return { ok: false, errors };
      }
      validated = parsed.data;
    }

    const portfolio: Portfolio = {
      ...existing.portfolio,
      v4CollateralRisk: validated,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      portfolios: { ...state.portfolios, [id]: { portfolio, summary: buildSummary(portfolio) } },
      errors: [],
    }));
    schedulePortfolioSave(portfolio);

    return { ok: true, data: portfolio };
  },
}));

/**
 * Mirrors `autoSaveCoordinator`'s real, asynchronous save state for the
 * most recently mutated portfolio back into `saveStatus` — declared
 * after `usePortfolioStore` itself (not inside its own initializer) to
 * avoid referencing the Store before it exists. Runs once at module
 * load, for the lifetime of the process, the same "one shared
 * subscription" shape `autoSaveCoordinator` itself already uses
 * internally for its own listeners.
 *
 * Filters on `recordType === 'portfolio'` and `id === lastPersistedPortfolioId`
 * — the coordinator's `subscribe` fires for *every* record's state
 * change across the whole application (every Store shares one
 * coordinator instance), not just this Store's own. Without this filter,
 * an unrelated event (e.g. `select`'s own `'activePortfolio'` write
 * settling) would re-read and re-apply the portfolio's last known state
 * regardless of whether anything about *it* actually changed — including
 * `'idle'`, correctly reachable after a successful delete.
 */
autoSaveCoordinator.subscribe((recordType, id, state) => {
  if (recordType !== 'portfolio' || id !== lastPersistedPortfolioId) return;
  usePortfolioStore.setState({ saveStatus: state });
});
