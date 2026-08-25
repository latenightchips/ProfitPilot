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
  type AaveV4DataSource,
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
  /**
   * V4 Readiness Audit §12 — P0-1 (manual/live conflict handling). A
   * live fetch whose value differs from an existing MANUAL
   * `v4DebtState` is held here, keyed by portfolio id, until the user
   * explicitly accepts or dismisses it via
   * `acceptAaveV4DebtStateCandidate`/`dismissAaveV4DebtStateCandidate` —
   * it never becomes canonical on its own. Deliberately NOT part of
   * `Portfolio`/the persistence schema (no schema change was needed or
   * made for this stage): this is ephemeral, session-only UI state,
   * exactly like `errors` above — a hard reload discards it and the
   * next live fetch simply re-evaluates the conflict from scratch. See
   * `hooks/useAaveV4LiveSync.ts`'s own header comment for the full
   * manual-vs-live decision this backs.
   */
  v4DebtStateCandidates: Record<string, AaveV4DebtState | undefined>;
  /** Same role as `v4DebtStateCandidates` above, independently, for `v4CollateralRisk`. See `hooks/useAaveV4CollateralRiskLiveSync.ts`. */
  v4CollateralRiskCandidates: Record<string, AaveV4CollateralRiskConfig | undefined>;
  /**
   * V4 Readiness Audit §12 — P0-4 (classified live-fetch error
   * surfacing). The classified `AAVE_V4_*` code/message behind the most
   * recent FAILED `v4DebtState` live fetch for one portfolio, keyed by
   * portfolio id — `undefined` whenever there is no current error to
   * show (no attempt yet, last attempt succeeded, or the V4 identity
   * that produced it has since been removed/switched). Set only by
   * `hooks/useAaveV4LiveSync.ts`'s own write effect, strictly guarded
   * against that portfolio's CURRENT identity (never a stale/foreign
   * one — see that hook's own header comment). Deliberately NOT part of
   * `Portfolio`/the persistence schema, exactly like
   * `v4DebtStateCandidates` above — ephemeral, session-only UI state.
   */
  v4DebtStateErrors: Record<string, { code: string | null; message: string } | undefined>;
  /** Same role as `v4DebtStateErrors` above, independently, for `v4CollateralRisk`. See `hooks/useAaveV4CollateralRiskLiveSync.ts`. */
  v4CollateralRiskErrors: Record<string, { code: string | null; message: string } | undefined>;
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
  /**
   * V4 Readiness Audit §12 Stage 25 — `source` is optional and defaults
   * to `'live'` when a defined `v4DebtState` is supplied without one.
   * `'live'` is the correct default, not just a convenient one: every
   * caller of this action before this stage (the two live-sync hooks,
   * and every existing test's own fixture setup) was already modeling a
   * live-synced value — defaulting preserves that behavior for all of
   * them unchanged. Only a caller that genuinely means "manual" (the new
   * manual-entry form) or that must PRESERVE an existing, possibly
   * manual, source (`DebtPositionForm`'s repay path, which derives a new
   * `v4DebtState` from whatever the old one's provenance already was)
   * needs to pass `source` explicitly. See `AaveV4DataSource`'s own doc
   * comment (`services/portfolio/models.ts`) for what the two values
   * mean, and `normalizeV4Provenance` above for the SEPARATE, more
   * conservative default (`'manual'`, never silently `'live'`) this
   * Store applies to historical PERSISTED data with no recorded source —
   * a different problem in a different context, not a contradiction.
   */
  setAaveV4DebtState: (
    id: string,
    v4DebtState: AaveV4DebtState | undefined,
    source?: AaveV4DataSource,
  ) => MappingResult<Portfolio>;
  /** Same optional-`source`-defaults-to-`'live'` discipline as `setAaveV4DebtState` above. */
  setAaveV4CollateralRisk: (
    id: string,
    v4CollateralRisk: AaveV4CollateralRiskConfig | undefined,
    source?: AaveV4DataSource,
  ) => MappingResult<Portfolio>;
  /**
   * V4 Readiness Audit §12 — P0-1. Registers (or clears, via `undefined`)
   * a pending manual/live conflict candidate for one portfolio's
   * `v4DebtState` — called only by `hooks/useAaveV4LiveSync.ts`'s own
   * write effect when a fresh live fetch differs from an existing
   * MANUAL value. Never touches `portfolios`/canonical state itself.
   */
  setAaveV4DebtStateCandidate: (id: string, candidate: AaveV4DebtState | undefined) => void;
  /**
   * The "Use Live Data" action: writes the portfolio's currently pending
   * `v4DebtState` candidate as the new canonical `'live'` value (via
   * `setAaveV4DebtState`, which also clears the candidate as part of its
   * own write — see that action's own comment) and returns the same
   * `MappingResult` shape. Fails with a validation error if no candidate
   * is currently pending for this portfolio — defensive: the UI only
   * ever renders this action when one exists.
   */
  acceptAaveV4DebtStateCandidate: (id: string) => MappingResult<Portfolio>;
  /**
   * The "Keep Manual" action: discards the pending `v4DebtState`
   * candidate without writing anything. Canonical state (manual or
   * otherwise) is left completely untouched. Does not disable future
   * live synchronization — the next genuinely new fetch is free to
   * surface a new candidate on its own schedule.
   */
  dismissAaveV4DebtStateCandidate: (id: string) => void;
  /** Same role as `setAaveV4DebtStateCandidate` above, independently, for `v4CollateralRisk`. */
  setAaveV4CollateralRiskCandidate: (
    id: string,
    candidate: AaveV4CollateralRiskConfig | undefined,
  ) => void;
  /** Same role as `acceptAaveV4DebtStateCandidate` above, independently, for `v4CollateralRisk`. */
  acceptAaveV4CollateralRiskCandidate: (id: string) => MappingResult<Portfolio>;
  /** Same role as `dismissAaveV4DebtStateCandidate` above, independently, for `v4CollateralRisk`. */
  dismissAaveV4CollateralRiskCandidate: (id: string) => void;
  /**
   * V4 Readiness Audit §12 — P0-4. Sets (or clears, via `undefined`) the
   * classified error currently displayed for one portfolio's
   * `v4DebtState` live sync. Called only by `hooks/useAaveV4LiveSync.ts`'s
   * own write effect — never touches `portfolios`/canonical state, and
   * never interacts with `v4DebtStateCandidates`.
   */
  setAaveV4DebtStateError: (
    id: string,
    error: { code: string | null; message: string } | undefined,
  ) => void;
  /** Same role as `setAaveV4DebtStateError` above, independently, for `v4CollateralRisk`. */
  setAaveV4CollateralRiskError: (
    id: string,
    error: { code: string | null; message: string } | undefined,
  ) => void;
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

/** V4 Readiness Audit §12 — P0-1. Defensive: the UI only ever calls an accept action when a candidate is actually pending. */
function noPendingCandidateError(
  id: string,
  dimension: 'v4DebtState' | 'v4CollateralRisk',
): ApplicationError {
  return createApplicationError(
    'validation',
    'AAVE_V4_NO_PENDING_CANDIDATE',
    `No pending live ${dimension} candidate exists for portfolio "${id}".`,
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
 *
 * **Deliberately excludes `debtAssetPriceUsd` (V4 Readiness Audit §12
 * P1-D3).** This function answers two different questions for its two
 * call sites in `useAaveV4LiveSync.ts`: "did a live refresh actually
 * change anything" (live→live), and "does an existing MANUAL value
 * numerically match a live fetch" (manual→live, Stage 25's "identical
 * values transition silently" rule). A manual `v4DebtState` never carries
 * a price at all (no UI collects one — see `AaveV4DebtState`'s own doc
 * comment), so if this function compared `debtAssetPriceUsd`, EVERY
 * manual entry that otherwise exactly matches live data would register as
 * "different" purely because manual has no price field to compare —
 * manufacturing a spurious manual-vs-live conflict confirmation for a
 * case Stage 25 explicitly says must transition silently. Excluding it
 * here keeps that comparison meaning "do the actual debt assumptions
 * agree," not "does one side happen to carry a field the other never can."
 * The live→live call site needs the stricter, price-INCLUDING check (a
 * price-only refresh must still apply) — it performs that check itself,
 * alongside this function, rather than requiring one here that would
 * break the other call site. See that call site's own comment.
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
 * `aaveV4CollateralRiskEqual` (V4 Readiness Audit §12 Stage 23F) — same
 * equality-gate role as `aaveV4DebtStateEqual` above, for
 * `hooks/useAaveV4CollateralRiskLiveSync.ts`'s own sync effect.
 * `dynamicConfigKey` is compared alongside `collateralFactor`, not
 * dropped — it is real provenance (which bound dynamic-config version the
 * value was read at, `AaveV4CollateralRiskConfig`'s own doc comment), so a
 * key change with a coincidentally-equal `collateralFactor` still counts
 * as a real change worth writing (and worth clearing an open Preview
 * for), not a no-op.
 */
export function aaveV4CollateralRiskEqual(
  a: AaveV4CollateralRiskConfig | undefined,
  b: AaveV4CollateralRiskConfig | undefined,
): boolean {
  if (a === undefined || b === undefined) return a === b;
  return a.collateralFactor === b.collateralFactor && a.dynamicConfigKey === b.dynamicConfigKey;
}

/**
 * Backfills `v4DebtStateSource`/`v4CollateralRiskSource` for a portfolio
 * loaded from persisted storage — V4 Readiness Audit §12 Stage 25. Every
 * portfolio persisted before this stage may already carry a real
 * `v4DebtState`/`v4CollateralRisk` (necessarily written by a live sync,
 * since manual entry did not exist before now) but has no source field at
 * all, since `persistedPortfolioPayloadSchema` only started accepting it
 * this stage.
 *
 * **Defaults the gap to `'manual'`, never `'live'`.** "Do not silently
 * classify historical state as live unless that can actually be proven"
 * (this stage's own explicit requirement) — we cannot prove a historical
 * value is still fresh/correct, so asserting `'live'` here would be
 * exactly the kind of unproven claim the requirement forbids. `'manual'`
 * is the conservative, provable choice: the value is real and usable
 * (calculations proceed exactly as they already did before this stage),
 * but the status badge won't claim a freshness guarantee this Store has
 * no way to back up. A live sync, if the portfolio still has a
 * `v4Position` address, will naturally overwrite this with real `'live'`
 * provenance on the next successful fetch — the normal manual→live
 * transition, not a special migration path.
 *
 * Maintains the same "source is defined if and only if the value is"
 * invariant `setAaveV4DebtState`/`setAaveV4CollateralRisk` themselves
 * enforce, for a portfolio that was never touched by an already-normalized write.
 */
function normalizeV4Provenance(portfolio: Portfolio): Portfolio {
  const v4DebtStateSource =
    portfolio.v4DebtState !== undefined ? (portfolio.v4DebtStateSource ?? 'manual') : undefined;
  const v4CollateralRiskSource =
    portfolio.v4CollateralRisk !== undefined
      ? (portfolio.v4CollateralRiskSource ?? 'manual')
      : undefined;

  if (
    v4DebtStateSource === portfolio.v4DebtStateSource &&
    v4CollateralRiskSource === portfolio.v4CollateralRiskSource
  ) {
    return portfolio;
  }

  return { ...portfolio, v4DebtStateSource, v4CollateralRiskSource };
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
  v4DebtStateCandidates: {},
  v4CollateralRiskCandidates: {},
  v4DebtStateErrors: {},
  v4CollateralRiskErrors: {},

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
    for (const raw of portfoliosResult.data) {
      const portfolio = normalizeV4Provenance(raw);
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

  setAaveV4DebtState: (
    id: string,
    v4DebtState: AaveV4DebtState | undefined,
    source?: AaveV4DataSource,
  ) => {
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
      // V4 Readiness Audit §12 Stage 25 — the invariant `ApplicationPortfolio`'s
      // own doc comment documents: a source is recorded if and only if a
      // value is. Clearing (`validated === undefined`) also clears the
      // source, never leaving an orphaned provenance flag behind.
      // Defaults an omitted `source` to `'live'` — see this action's own
      // interface doc comment for why that default, not `'manual'`, is
      // correct here.
      v4DebtStateSource: validated !== undefined ? (source ?? 'live') : undefined,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      portfolios: { ...state.portfolios, [id]: { portfolio, summary: buildSummary(portfolio) } },
      errors: [],
      // V4 Readiness Audit §12 — P0-1. ANY explicit write to canonical
      // `v4DebtState` — a manual submit, the hook's own auto-adopt/live
      // refresh, or `acceptAaveV4DebtStateCandidate` itself — makes a
      // previously-pending candidate stale relative to the new baseline
      // it was computed against (or, if this write IS the acceptance,
      // the candidate has just become canonical). Clearing it centrally
      // here, rather than at every call site, is what keeps this the
      // smallest correct change: no caller needs to remember to do it.
      v4DebtStateCandidates: { ...state.v4DebtStateCandidates, [id]: undefined },
    }));
    schedulePortfolioSave(portfolio);

    return { ok: true, data: portfolio };
  },

  setAaveV4CollateralRisk: (
    id: string,
    v4CollateralRisk: AaveV4CollateralRiskConfig | undefined,
    source?: AaveV4DataSource,
  ) => {
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
      // Same invariant, and same `'live'` default, as `setAaveV4DebtState` above.
      v4CollateralRiskSource: validated !== undefined ? (source ?? 'live') : undefined,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      portfolios: { ...state.portfolios, [id]: { portfolio, summary: buildSummary(portfolio) } },
      errors: [],
      // Same reasoning as `setAaveV4DebtState`'s own identical clear above.
      v4CollateralRiskCandidates: { ...state.v4CollateralRiskCandidates, [id]: undefined },
    }));
    schedulePortfolioSave(portfolio);

    return { ok: true, data: portfolio };
  },

  setAaveV4DebtStateCandidate: (id, candidate) => {
    set((state) => ({
      v4DebtStateCandidates: { ...state.v4DebtStateCandidates, [id]: candidate },
    }));
  },

  acceptAaveV4DebtStateCandidate: (id) => {
    const candidate = get().v4DebtStateCandidates[id];
    if (candidate === undefined) {
      const errors = [noPendingCandidateError(id, 'v4DebtState')];
      set({ errors });
      return { ok: false, errors };
    }
    // `setAaveV4DebtState` itself clears the candidate as part of its
    // own write (see its own comment) — no separate clear needed here.
    return get().setAaveV4DebtState(id, candidate, 'live');
  },

  dismissAaveV4DebtStateCandidate: (id) => {
    set((state) => ({
      v4DebtStateCandidates: { ...state.v4DebtStateCandidates, [id]: undefined },
    }));
  },

  setAaveV4CollateralRiskCandidate: (id, candidate) => {
    set((state) => ({
      v4CollateralRiskCandidates: { ...state.v4CollateralRiskCandidates, [id]: candidate },
    }));
  },

  acceptAaveV4CollateralRiskCandidate: (id) => {
    const candidate = get().v4CollateralRiskCandidates[id];
    if (candidate === undefined) {
      const errors = [noPendingCandidateError(id, 'v4CollateralRisk')];
      set({ errors });
      return { ok: false, errors };
    }
    return get().setAaveV4CollateralRisk(id, candidate, 'live');
  },

  dismissAaveV4CollateralRiskCandidate: (id) => {
    set((state) => ({
      v4CollateralRiskCandidates: { ...state.v4CollateralRiskCandidates, [id]: undefined },
    }));
  },

  setAaveV4DebtStateError: (id, error) => {
    set((state) => ({
      v4DebtStateErrors: { ...state.v4DebtStateErrors, [id]: error },
    }));
  },

  setAaveV4CollateralRiskError: (id, error) => {
    set((state) => ({
      v4CollateralRiskErrors: { ...state.v4CollateralRiskErrors, [id]: error },
    }));
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
