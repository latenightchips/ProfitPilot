'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  calculatePortfolioSummary,
  normalizeMarketQuote,
  normalizeProtocolQuote,
  type PortfolioSummary,
  type ServiceResult,
} from '@/services';
import { type PortfolioSaveStatus, usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';
import {
  type CollateralManagementInput,
  collateralManagementSchema,
  type DebtManagementInput,
  debtManagementSchema,
  type PortfolioDetailsInput,
  portfolioDetailsSchema,
} from '@/types/portfolio.schema';
import { downloadPortfolioRecoveryCopy } from '@/utils/portfolioRecoveryExport';

import { LiveAaveDataPanel } from './LiveAaveDataPanel';

/**
 * Portfolio Details Form — 06_TASKS.md M4-006 ("Implement Portfolio
 * Details Form"): "Create a form for editing general portfolio
 * information." Fields: "Name, Description, Base currency, Default
 * display settings, Safety target settings." Requirements: "Use React
 * Hook Form. Use Zod validation. Support automatic saving." DoD:
 * "Changes persist and do not alter position balances unexpectedly."
 *
 * Replaces the `/portfolio` route's Milestone 1 `PlaceholderPage` —
 * this task's own Dependencies chain (M4-005 → M4-003 → M3-005) names
 * no other UI task that would build this route first, and 03_UI.md's
 * own "PORTFOLIO PAGE" section already names this exact route for
 * exactly this purpose ("What do I own?"). The read-only calculated
 * metrics that same 03_UI.md section also describes (Position Metrics,
 * Milestones, Interest, Performance) are **not** built here — no task in
 * this batch covers them; only the editable identity/settings/position
 * fields M4-006/M4-007/M4-008 themselves name.
 *
 * **"Default display settings" is not rendered** — conflict #22
 * (`types/portfolio.ts`): no field list for it exists anywhere in the
 * documentation, so `PortfolioSettings` never modeled it. Only "Safety
 * target settings" (`settings.safetyTargets`) is editable here.
 *
 * **"Support automatic saving" — auto-save to the in-memory Store, not
 * to disk.** Conflict B (Milestone 4 plan): no persistence
 * infrastructure exists before Milestone 8. "Saving" here means
 * debounced calls to `store.update()`, which commits to the Store's
 * in-memory state — the same "saved = in the Store" framing already
 * established for M4-003/M4-005. No manual save button, matching
 * 04_BUILD_GUIDE.md's own "No manual save button is required" principle
 * for auto-save UX.
 *
 * **DoD "do not alter position balances unexpectedly" — enforced
 * structurally, not just by care**: `portfolioDetailsSchema`
 * (`types/portfolio.schema.ts`) is `portfolioInputSchema.pick({name,
 * description, baseCurrency, settings})` — the update payload this form
 * can ever produce is *type-incapable* of containing
 * `collateral`/`debt`/`market`/`protocol`, so there is no code path
 * here that could touch position balances even by mistake.
 *
 * **Remounted (`key={activePortfolioId}`) on portfolio switch**: forces
 * React Hook Form's internal state to fully reset to the newly active
 * portfolio's own values rather than carrying over stale field state —
 * the concrete mechanism behind M4-010's own DoD ("Switching portfolios
 * never mixes state between portfolios") as it applies to this form.
 *
 * ---
 *
 * **Collateral/Debt Position Management — 06_TASKS.md M4-007/M4-008.**
 * Both allow "add, edit, and remove" a position; under Conflict A
 * (approved, single-position model) that means the one collateral slot
 * and the one debt slot's lifecycle (set from zero, change, clear back
 * to zero) — not an array. "Prevent duplicate invalid positions" is
 * structurally satisfied by the same single-slot model (nothing to
 * de-duplicate).
 *
 * **Preview mechanism — deliberately not `previewPortfolioAction`
 * (M3-006)**: that Service's `PortfolioAction` union changes exactly one
 * field per call (`addCollateral`, `changeProtocolParameters`, etc.).
 * These forms let a user edit a position field *and* its related
 * protocol field(s) together in one preview (e.g., quantity and
 * Liquidation threshold at once) — no single `PortfolioAction` variant
 * represents that combination. Rather than force an artificial
 * one-field-at-a-time flow the task text doesn't ask for, both forms
 * compose the same "snapshot, apply change, snapshot again" pattern
 * `previewPortfolioAction` itself uses, directly via
 * `calculatePortfolioSummary` (M3-005) — still Service-delegated
 * calculation, just without the single-action constraint.
 *
 * **Preview is a hard gate, not just a display**: `watch()` clears any
 * existing preview the instant a field changes, and "Apply" is disabled
 * whenever no preview exists — so a stale preview can never be applied
 * silently. This is the concrete mechanism behind "Preview effects
 * before destructive changes" (M4-007) / "Preview Health Factor impact"
 * (M4-008): every change is previewed before it can be applied.
 *
 * ---
 *
 * **Portfolio Action Preview — 06_TASKS.md M4-009.** "Display: Net
 * equity change, LTV change, Health Factor change, Liquidation price
 * change, Warnings." "DoD: Risk-increasing changes require explicit
 * confirmation after preview." Extends `PreviewDiff` (built in Batch 4
 * for M4-007/M4-008) rather than a new component — M4-009's own
 * Dependencies (M4-007, M4-008) and "Display" list are a direct
 * refinement of what that component already showed (Net Equity, Health
 * Factor, LTV), adding the two fields it was missing (Liquidation price,
 * Warnings) and the risk-increasing confirmation gate.
 *
 * **Metrics come from `calculatePortfolioSummary` (M3-005) alone** —
 * `before`/`after` are both `PortfolioSummary` values already computed
 * by that Service (the "before" from the Store's own cached
 * `record.summary`, Batch 1; the "after" from this file's own preview
 * mechanism, Batch 4). `PreviewDiff` only formats and diffs fields
 * already present on that Service's output; it computes nothing new.
 * "Warnings" reads `after.warnings` directly — `ServiceResult`'s own
 * field (M3-002) — not a UI-invented list.
 *
 * **Still deliberately not `previewPortfolioAction` (M3-006), despite
 * M4-009 naming it as a Dependency**: see the note above this one for
 * why — `PortfolioAction`'s six variants each change exactly one field,
 * and these forms combine a position field with a protocol field in one
 * preview. `previewPortfolioAction`'s own return shape
 * (`{before: PortfolioSummary, after: PortfolioSummary}`) is structurally
 * identical to what `PreviewDiff` already consumes, so the M3-006
 * dependency is satisfied at the architectural level (this *is* the
 * "Portfolio Action Preview" concept, built on the same M3-005 Service
 * `previewPortfolioAction` itself wraps) without literally calling a
 * Service whose action union can't represent these forms' combined
 * edits.
 *
 * **"Liquidation price change"**: both `before.liquidation` and
 * `after.liquidation` can be `null` for a zero-debt portfolio (conflict
 * #20, resolved Batch 0) — shown as "N/A (no debt)" on whichever side is
 * `null`, not a fabricated number.
 *
 * **"Risk-increasing" — no value domain is defined anywhere in the
 * documentation** (grepped `01_PRD.md`/`02_Formulas.md`/
 * `04_BUILD_GUIDE.md`/`06_TASKS.md`; the term appears only in M4-009's
 * own DoD and Milestone 4's acceptance criteria, with no threshold, band,
 * or scoring rule). Per instruction, no risk band, label, or threshold is
 * invented. Resolved with the most conservative possible reading: a
 * change is "risk-increasing" exactly when it strictly lowers Health
 * Factor (`isRiskIncreasing`, below) — a directional comparison of two
 * numbers `calculatePortfolioSummary` already produces, not a new
 * formula, scoring system, or numeric boundary. If the "before" summary
 * is itself unreadable (should not occur in practice — the Store only
 * holds already-valid portfolios), the change is conservatively treated
 * as risk-increasing rather than silently skipping confirmation.
 * Risk-increasing previews require an explicit checkbox acknowledgment
 * before "Apply Changes" becomes enabled, on top of the preview hard
 * gate every change already has (M4-007/M4-008); non-risk-increasing
 * previews are unaffected, unchanged from Batch 4.
 *
 * **"Price source" (M4-007) / "Price" (M4-008) — read-only, not
 * editable inputs.** No live price/rate source exists anywhere in this
 * codebase (the `PriceProvider`/`AaveV3Provider` infrastructure layer
 * was never built — see PROJECT_STATUS.md's Milestone 3 findings), so
 * "Price source" can only ever read "Manual" today; rendered as
 * informational text, not a selector with no second option. "Price" for
 * a debt position has no Engine-level counterpart at all —
 * `calculateDebtValue` (F-003)'s own equation is "Debt Value = Borrowed
 * Stablecoins," a hard 1:1 USD peg with no price parameter accepted —
 * shown as informational text stating that assumption (conflict #25),
 * not a fabricated editable field with nothing to actually affect.
 *
 * **"Rate type" (M4-008) — not rendered, documented gap (conflict
 * #25).** No value domain (Fixed/Variable, or anything else) is defined
 * anywhere in the documentation, and the Engine work that would
 * naturally house a fixed-vs-variable distinction (M2-013/M2-014,
 * "Variable Rate Projection") was formally blocked and never
 * implemented (conflict #7) — there is nothing for this field to
 * control even if a UI control were built.
 *
 * **"Manual price" (M4-007) writes to `portfolio.market.btcPriceUsd`**,
 * the same field M4-005's Creation Flow calls "Manual BTC price" — this
 * batch gives it a basic editable input; the fuller manual-price UX
 * (timestamp, reset action, stale-data warning) is M4-014's own,
 * later, dedicated task.
 *
 * **"Maximum LTV"/"Liquidation threshold" (M4-007) and "Borrow rate"
 * (M4-008) write to `portfolio.protocol`** (a portfolio-level field, not
 * per-position in this data model) — each form edits only the 1–2
 * fields it names, carrying the other, untouched protocol fields
 * through unedited via hidden inputs so the full, valid
 * `ProtocolParameters` object is always submitted together. The fuller
 * "preset selection"/"freshness status" UX is M4-015's own, later,
 * dedicated task.
 *
 * ---
 *
 * **Manual Price Controls — 06_TASKS.md M4-014.** Include: "Price input,
 * Timestamp, Manual-data indicator, Reset action, Stale-data warning."
 * "Price input" already existed (Batch 4's "Manual price (USD)" field).
 * This batch adds the other four, in `CollateralPositionForm`:
 * - **Timestamp / Manual-data indicator**: `Portfolio.marketUpdatedAt`
 *   (new field, `types/portfolio.ts`) is displayed as "Last updated," next
 *   to a "Manual" badge — the Store never has anything but a manually
 *   entered price (no live provider exists anywhere in this codebase; see
 *   M3-007's own header comment), so "Manual" is always correct, not a
 *   guess.
 * - **Stale-data warning**: reuses `normalizeMarketQuote` (M3-007, Market
 *   Data Service) — its own already-documented, non-invented 5-minute
 *   Fresh/Stale rule (`04_BUILD_GUIDE.md` "PRICE FRESHNESS"), the actual
 *   reason M4-014 names M3-007 as a Dependency. Never wired into any UI
 *   before this batch. `getMarketQuote` below calls it with the one
 *   candidate this app can ever produce (`origin: 'manual'`,
 *   `timestamp: portfolio.marketUpdatedAt`) — reusing the Service's own
 *   threshold rather than re-implementing "5 minutes" inline.
 * - **Reset action**: reverts the *unsaved* price field back to the
 *   currently-applied value (`resetField('market.btcPriceUsd')`) — the
 *   only sensible meaning of "reset" here, since there is no live/cached
 *   price to reset *to* (no provider, no cache candidate ever exists).
 *
 * **Manual-data indicator / Freshness display placed on
 * `Portfolio`, not `MarketPrices`/`ProtocolParameters`** — see
 * `types/portfolio.ts`'s own header comment for why `marketUpdatedAt`/
 * `protocolUpdatedAt` had to be added there: neither Engine type
 * (`engine/shared/types.ts`, M2-002) carries a timestamp at all.
 *
 * ---
 *
 * **Protocol Configuration Controls — 06_TASKS.md M4-015.** Include:
 * "Maximum LTV, Liquidation threshold, Borrow rate, Parameter source,
 * Freshness status." The three parameter fields already existed (Batch
 * 4). This batch adds "Parameter source" and "Freshness status" — shown
 * identically in both `CollateralPositionForm` (which edits Maximum
 * LTV/Liquidation threshold) and `DebtPositionForm` (which edits Borrow
 * rate), since both edit the same shared `portfolio.protocol` object;
 * M4-015's own Dependencies list only M4-007, but "Borrow rate" is one of
 * its own named fields and that field's control lives in M4-008's form —
 * a minor pre-existing inconsistency in the task's own Dependencies, not
 * a new conflict, resolved by showing the shared status wherever a
 * protocol field is actually edited.
 *
 * **"Parameter source"**: always "Manual," for the same reason as the
 * price ("Protocol Data" providers were never built — see M3-008's own
 * header comment). **"Freshness status"**: reuses `normalizeProtocolQuote`
 * (M3-008, Protocol Parameter Service) via `getProtocolQuote` below —
 * deliberately *not* a fresh/stale classification. M3-008's own header
 * comment explains why no such threshold exists: `04_BUILD_GUIDE.md`
 * defines a concrete staleness rule for prices but no equivalent one for
 * protocol parameters, only a raw timestamp — inventing one here would
 * contradict that Service's own already-made decision. Displayed as
 * "Last updated" with no stale/fresh language, matching the Service's
 * exact behavior.
 *
 * **"Preset selection" — still not offered, same root cause as conflict
 * #24 (M4-005, Batch 3)**: M4-015's own Description repeats "select a
 * supported protocol preset or enter parameters manually," but no
 * concrete Aave V3 preset values exist anywhere in the documentation.
 * Not a new conflict — the same one recurring, resolved identically:
 * manual entry only.
 *
 * **"Changes trigger recalculation and clearly identify manual
 * assumptions" (M4-015 DoD)**: satisfied by mechanisms that already
 * existed before this batch — the preview hard gate (any field change
 * clears a stale preview, Batch 4) covers "trigger recalculation"; the
 * "Manual"/"Parameter source: Manual" badges cover "identify manual
 * assumptions." No new logic was needed for the DoD itself.
 *
 * ---
 *
 * **Portfolio Auto-Save — 06_TASKS.md M4-013.** Requirements: "Debounce
 * rapid edits. Display save state. Retry transient failures. Avoid
 * saving invalid drafts. Prevent stale updates from overwriting newer
 * state." DoD: "Users receive clear saved, saving, offline, and failed
 * states."
 *
 * **Auto-save (debounce) applies only to `PortfolioDetailsForm`
 * (M4-006), unchanged from Batch 3 — deliberately not extended to the
 * Collateral/Debt Position Management forms (M4-007/M4-008).**
 * `04_BUILD_GUIDE.md`'s "AUTO SAVE" section broadly says "ProfitPilot
 * automatically saves Portfolio changes" with no field-level carve-out,
 * and M4-013 names M4-007/M4-008 as Dependencies — read naively, this
 * suggests position/protocol/price edits should auto-save too. But
 * M4-009's own DoD ("Risk-increasing changes require explicit
 * confirmation after preview") — implemented across Batches 4–5,
 * approved, and tested — requires exactly the opposite for those same
 * fields: an explicit Preview → Apply step, with a required
 * risk-acknowledgment checkbox for risk-increasing changes. Auto-saving
 * a position edit the instant it's typed would silently apply it before
 * any preview or confirmation ever happens, deleting the mechanism
 * M4-009 required. Resolved in favor of the more specific, later,
 * already-implemented rule over the general auto-save principle — not a
 * new invented behavior, a conflict between two existing ones, resolved
 * without regressing already-approved work. Documented as conflict #28.
 *
 * **"Display save state"**: a single status line (`formatSaveStatus`,
 * below) reads the Store's one *global* `saveStatus` field (Batch 1) —
 * real transitions added this batch in `stores/portfolioStore.ts`
 * (`'saving'` → `'saved'`/`'error'` for every mutating action). Shown
 * once per page, not per form, since it is one Store-wide value, the
 * same reasoning the Portfolio List Page (Batch 2) already used for
 * this identical field.
 *
 * **"Retry transient failures" — not built; no transient failure mode
 * exists.** The only failure mode this Store has is Zod validation
 * (deterministic — the same invalid input fails the same way every
 * time), which the existing inline field errors already let the user
 * correct. See `stores/portfolioStore.ts`'s own M4-013 note for the
 * fuller reasoning, including why `'offline'` was not wired to
 * `navigator.onLine` either (it would be real code with a false
 * meaning, not merely an unbuilt feature).
 *
 * **"Avoid saving invalid drafts"**: already true everywhere on this
 * page before this batch — every form runs its data through a Zod
 * schema (`portfolioDetailsSchema`/`collateralManagementSchema`/
 * `debtManagementSchema`) before `store.update()` is ever called, and
 * the Store re-validates again on its own (M4-002's own DoD). No new
 * code was needed for this Requirement.
 *
 * **"Prevent stale updates from overwriting newer state"** — the Store
 * layer already guarantees this structurally (see
 * `stores/portfolioStore.ts`'s own M4-013 note). Auditing this
 * Requirement across all three forms on this page surfaced one genuinely
 * reachable gap this batch fixes: `CollateralPositionForm`/
 * `DebtPositionForm` previously only cleared an open preview when *their
 * own* fields changed (`watch()`, Batch 4) — not when a *sibling* form
 * applied a change to the same portfolio. A user could preview a
 * Collateral edit, then apply a Debt edit in the other form, and the
 * Collateral form's now-stale preview (computed against the
 * pre-Debt-edit portfolio) would still show "Apply Changes" enabled. Both
 * forms now also clear their preview/acknowledgment whenever
 * `portfolio.updatedAt` changes for any reason, closing this gap. This is
 * a stale *preview* (component-local UI state), not a stale *Store
 * write* — the Store itself was never at risk of losing an update.
 *
 * ---
 *
 * **Portfolio Error Recovery — 06_TASKS.md M4-017.** Description:
 * "Handle portfolio loading, calculation, validation, and saving
 * failures." Include: "Retry. Return to portfolio list. Restore last
 * valid state. Export recovery copy where possible." DoD: "A failed
 * operation does not silently destroy or replace valid portfolio data."
 *
 * **Loading failures — not reachable, same as M4-013's `'offline'`.**
 * `load()` (Batch 1) has no persistence layer to fail against under
 * Conflict B; nothing to recover from here yet.
 *
 * **Validation/saving failures — "restore last valid state" already
 * structurally guaranteed, confirmed rather than assumed.**
 * `store.update()`/`store.create()` only ever call their mutating
 * `set()` *after* Zod validation succeeds (`stores/portfolioStore.ts`)
 * — a rejected update never touches the existing, still-valid record.
 * This is exactly 01_PRD.md's own generic state-machine "ERROR RECOVERY"
 * pattern ("If a state update fails → Rollback → Restore Previous
 * State → Display Error → Continue Running"), already satisfied by the
 * existing validate-before-mutate design, not new code.
 *
 * **Calculation failures — genuinely reachable via real, Zod-valid
 * input, confirmed by reading the Engine functions
 * `calculatePortfolioSummary` composes, not assumed.** Three real
 * divide-by-zero cases exist for otherwise-valid portfolios: zero
 * collateral with nonzero debt (`calculateLoanToValue`), collateral
 * value exactly equal to debt value (`calculateEffectiveLeverage`), and
 * a zero Liquidation threshold with nonzero debt
 * (`calculateLiquidationPrice`). The Portfolio Creation Flow (M4-005)
 * and Position Management forms (M4-007/M4-008) can all produce these —
 * `store.create()`'s own redirect to this page happens regardless of
 * whether the resulting summary calculated successfully, so this is a
 * real, user-reachable gap this batch closes with
 * `CalculationErrorBanner` (below): a clear error message
 * (`summary.errors[0].message`), a "Retry" button, and a "Return to
 * portfolio list" link.
 *
 * **"Retry" (`store.recomputeSummary`) — genuinely re-runs the
 * calculation, but honestly cannot "fix" anything by itself, confirmed
 * by testing rather than assumed.** Every mutating Store action already
 * recomputes and re-caches the summary on every commit
 * (`stores/portfolioStore.ts`, Batch 1), so a cached summary is *never*
 * stale relative to the currently-stored portfolio — unlike M4-013's
 * rejected "Retry" (there, the block was "no transient failure exists to
 * retry"), here the calculation is real and reachable, but deterministic:
 * re-running it against *unchanged* data reproduces the identical
 * failure every time (verified in
 * `tests/unit/app/portfolio/page.test.tsx`). Its honest value is
 * matching 03_UI.md's explicit "ERROR RECOVERY" spec item and giving the
 * user an explicit, visible re-attempt action, not a claim that clicking
 * it can resolve the error on its own — fixing the underlying position
 * (via the Collateral/Debt forms below, which already clear the banner
 * automatically once applied, with no Retry click needed) is what
 * actually resolves it.
 *
 * Per 03_UI.md's own "ERROR RECOVERY" section ("Other application
 * sections should remain functional whenever possible"), the banner is
 * additive — the Details/Collateral/Debt forms keep rendering underneath
 * it; they already degrade gracefully for a failed `beforeSummary`
 * (`PreviewDiff`'s "—" fallbacks, Batch 4).
 *
 * **"Diagnostic Information (Developer Mode)" — not built.** 03_UI.md
 * names this as part of the same ERROR RECOVERY display, but "Developer
 * Mode" itself does not exist anywhere in this codebase yet (no task
 * reached so far builds it) — there is no mode to gate diagnostic
 * output behind. Left undone pending that mode's own task, rather than
 * inventing an ungated "always show diagnostics" panel no task asked
 * for.
 *
 * **"Export recovery copy where possible"**: `downloadPortfolioRecoveryCopy`
 * (`utils/portfolioRecoveryExport.ts`, new this batch) — see that file's
 * own header comment for why its scope is deliberately narrower than
 * 04_BUILD_GUIDE.md's fuller illustrative export shape.
 */
const AUTOSAVE_DEBOUNCE_MS = 600;

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatHealthFactor(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 }).format(
    value,
  );
}

/**
 * UX punch-list UX-01 — percentage-scale UI boundary conversion.
 * `protocol.maxLoanToValue`/`liquidationThreshold`/`borrowApr`/`supplyApr`
 * remain stored and validated as a 0–1 fraction throughout the Engine and
 * `types/portfolio.schema.ts` (unchanged); these two helpers are the only
 * place a fraction becomes the "75" a user types into these forms' number
 * inputs, and back. Used at exactly three points per field: the form's
 * `defaultValues` (initial display), `register`'s `setValueAs` (typed
 * value → decimal, before Zod validation), and the post-Apply `reset()`
 * call (decimal → display again) — never anywhere else, so a value is
 * converted exactly once in each direction.
 */
function toPercentInput(decimal: number): number {
  return decimal * 100;
}

function fromPercentInput(percent: number): number {
  return percent / 100;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

/**
 * M4-013's "Display save state" — see this file's own M4-013 header note
 * for why `'saving'` is real but practically never observed by a user
 * (every Store mutation is synchronous), and why `'offline'` never
 * occurs at all (no network dependency exists to go offline from).
 */
function formatSaveStatus(status: PortfolioSaveStatus): string {
  switch (status) {
    case 'idle':
      return 'No changes yet';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'error':
      return 'Error saving — see messages below';
    case 'offline':
      return 'Offline';
  }
}

/**
 * M4-014's stale-data warning — reuses `normalizeMarketQuote` (M3-007)
 * rather than re-implementing its 5-minute threshold. Returns `null` on
 * the (practically unreachable) `MappingFailure` case, since
 * `portfolio.market.btcPriceUsd` is already Zod-validated and
 * `marketUpdatedAt` is always a Store-generated ISO string.
 */
function getMarketQuote(portfolio: Portfolio) {
  const result = normalizeMarketQuote({
    asset: portfolio.collateral.asset,
    currency: 'USD',
    candidates: [
      {
        origin: 'manual',
        price: portfolio.market.btcPriceUsd,
        timestamp: portfolio.marketUpdatedAt,
      },
    ],
    now: new Date().toISOString(),
  });
  return result.ok ? result.data : null;
}

/**
 * M4-015's "Parameter source"/"Freshness status" — reuses
 * `normalizeProtocolQuote` (M3-008) rather than re-deriving the same
 * `origin`/`timestamp` pair inline.
 */
function getProtocolQuote(portfolio: Portfolio) {
  const result = normalizeProtocolQuote({
    collateralAsset: portfolio.collateral.asset,
    borrowAsset: portfolio.debt.asset,
    candidates: [
      { origin: 'manual', parameters: portfolio.protocol, timestamp: portfolio.protocolUpdatedAt },
    ],
  });
  return result.ok ? result.data : null;
}

/**
 * "Risk-increasing" — see this file's own M4-009 header note for the
 * full reasoning. A strict Health Factor decrease, nothing more.
 */
function isRiskIncreasing(
  before: ServiceResult<PortfolioSummary>,
  after: PortfolioSummary,
): boolean {
  if (!before.ok) return true;
  return after.healthFactor < before.data.healthFactor;
}

/**
 * Whether "Apply Changes" may be clicked — unchanged from Batch 4 for
 * the `preview === null`/`!preview.ok` cases (no preview yet, or an
 * invalid one still gets a chance to surface the Store's own validation
 * failure); new for M4-009: a valid, risk-increasing preview also needs
 * `riskAcknowledged`.
 */
function canApply(
  preview: ServiceResult<PortfolioSummary> | null,
  beforeSummary: ServiceResult<PortfolioSummary>,
  riskAcknowledged: boolean,
): boolean {
  if (preview === null) return false;
  if (!preview.ok) return true;
  return !isRiskIncreasing(beforeSummary, preview.data) || riskAcknowledged;
}

/**
 * PT-10 (physical-testing round 2) — "Apply Changes appears broken
 * because risk acknowledgement is easy to miss." `canApply` above is
 * unchanged (the safety gate itself is not being touched); this only
 * identifies the one specific case worth explaining inline — a valid,
 * risk-increasing preview blocked solely on the unchecked
 * acknowledgement box, as opposed to "no preview yet" or "preview
 * invalid," which already have their own, different affordances
 * (button disabled with nothing to preview yet; the Store's own error
 * message on an invalid preview).
 */
function blockedByRiskAcknowledgment(
  preview: ServiceResult<PortfolioSummary> | null,
  beforeSummary: ServiceResult<PortfolioSummary>,
  riskAcknowledged: boolean,
): boolean {
  return (
    preview !== null &&
    preview.ok &&
    isRiskIncreasing(beforeSummary, preview.data) &&
    !riskAcknowledged
  );
}

/**
 * M4-017 ("Implement Portfolio Error Recovery") — see this file's own
 * M4-017 header note for the full reasoning. Additive, not a
 * replacement: the caller keeps rendering the Details/Collateral/Debt
 * forms underneath this regardless ("Other application sections should
 * remain functional whenever possible," 03_UI.md).
 */
function CalculationErrorBanner({
  portfolioId,
  portfolio,
  summary,
}: {
  portfolioId: string;
  portfolio: Portfolio;
  summary: ServiceResult<PortfolioSummary>;
}) {
  const recomputeSummary = usePortfolioStore((state) => state.recomputeSummary);

  if (summary.ok) return null;

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
      <p className="font-medium text-destructive">
        {summary.errors[0]?.message ?? "This portfolio's summary could not be calculated."}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Your portfolio data is unchanged. Other sections of this page remain usable.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => recomputeSummary(portfolioId)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Retry
        </button>
        <Link
          href="/portfolios"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Return to portfolio list
        </Link>
        <button
          type="button"
          onClick={() => downloadPortfolioRecoveryCopy(portfolio)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Download recovery copy
        </button>
      </div>
    </div>
  );
}

type PortfolioDetailsFormValues = z.input<typeof portfolioDetailsSchema>;

/**
 * 06_TASKS.md M9-026 ("Audit Form Accessibility") — "Required-field
 * identification," shared by all three forms on this page. Decorative
 * `aria-hidden` asterisk only, paired with `aria-required="true"` on
 * each field for the actual screen-reader signal — see
 * `NewPortfolioPageClient.tsx`'s identical `RequiredMark` for the full
 * reasoning, including why a plain sr-only text node was tried first and
 * reverted (it silently broke this page's own `getByLabelText(...)`
 * unit test queries by becoming part of each label's accessible name).
 * Also not the native `required` attribute, for the same submit-time
 * reason documented there.
 */
function RequiredMark() {
  return <span aria-hidden="true">*</span>;
}

function PortfolioDetailsForm({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const update = usePortfolioStore((state) => state.update);

  const {
    register,
    watch,
    formState: { errors },
  } = useForm<PortfolioDetailsFormValues, unknown, PortfolioDetailsInput>({
    resolver: zodResolver(portfolioDetailsSchema),
    mode: 'onChange',
    defaultValues: {
      name: portfolio.name,
      description: portfolio.description,
      baseCurrency: portfolio.baseCurrency,
      settings: portfolio.settings,
    },
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = watch((values) => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const parsed = portfolioDetailsSchema.safeParse(values);
        if (parsed.success) update(portfolioId, parsed.data);
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [watch, portfolioId, update]);

  return (
    <form className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <p className="text-xs text-muted-foreground">Changes save automatically.</p>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">General</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Portfolio name <RequiredMark />
          </span>
          <input
            id="name"
            aria-required="true"
            {...register('name')}
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? 'name-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.name && (
          <span id="name-error" className="text-xs text-destructive">
            {errors.name.message}
          </span>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span>Description</span>
          <textarea
            id="description"
            {...register('description')}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Base currency <RequiredMark />
          </span>
          <input
            id="baseCurrency"
            aria-required="true"
            {...register('baseCurrency')}
            aria-invalid={errors.baseCurrency ? 'true' : undefined}
            aria-describedby={errors.baseCurrency ? 'baseCurrency-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.baseCurrency && (
          <span id="baseCurrency-error" className="text-xs text-destructive">
            {errors.baseCurrency.message}
          </span>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Safety target settings</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>Target Health Factor</span>
          <input
            type="number"
            step="any"
            {...register('settings.safetyTargets.targetHealthFactor', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Holding period (days)</span>
          <input
            type="number"
            step="any"
            {...register('settings.safetyTargets.holdingPeriodDays', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Target BTC price (USD)</span>
          <input
            type="number"
            step="any"
            {...register('settings.safetyTargets.targetBtcPriceUsd', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Safety buffer (%)</span>
          <input
            type="number"
            step="any"
            {...register('settings.safetyTargets.safetyBufferPercent', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
      </fieldset>
    </form>
  );
}

function formatLiquidationPrice(summary: PortfolioSummary): string {
  return summary.liquidation === null ? 'N/A (no debt)' : formatCurrency(summary.liquidation.price);
}

function PreviewDiff({
  before,
  after,
  riskAcknowledged,
  onRiskAcknowledgedChange,
}: {
  before: ServiceResult<PortfolioSummary>;
  after: ServiceResult<PortfolioSummary>;
  riskAcknowledged: boolean;
  onRiskAcknowledgedChange: (checked: boolean) => void;
}) {
  if (!after.ok) {
    return (
      <p className="text-sm text-destructive">
        {after.errors[0]?.message ?? 'This change would make the portfolio invalid.'}
      </p>
    );
  }

  const riskIncreasing = isRiskIncreasing(before, after.data);

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Net Equity</dt>
        <dd>
          {before.ok ? formatCurrency(before.data.netEquity) : '—'} →{' '}
          {formatCurrency(after.data.netEquity)}
        </dd>
        <dt className="text-muted-foreground">Health Factor</dt>
        <dd>
          {before.ok ? formatHealthFactor(before.data.healthFactor) : '—'} →{' '}
          {formatHealthFactor(after.data.healthFactor)}
        </dd>
        <dt className="text-muted-foreground">Loan-to-Value</dt>
        <dd>
          {before.ok ? formatPercent(before.data.loanToValue) : '—'} →{' '}
          {formatPercent(after.data.loanToValue)}
        </dd>
        <dt className="text-muted-foreground">Liquidation Price</dt>
        <dd>
          {before.ok ? formatLiquidationPrice(before.data) : '—'} →{' '}
          {formatLiquidationPrice(after.data)}
        </dd>
      </dl>

      {after.warnings.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {after.warnings.map((warning) => (
            <li key={warning.code}>⚠ {warning.message}</li>
          ))}
        </ul>
      )}

      {riskIncreasing && (
        <label
          id="risk-acknowledgment"
          className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm text-destructive"
        >
          <input
            type="checkbox"
            checked={riskAcknowledged}
            onChange={(event) => onRiskAcknowledgedChange(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <strong>Action required:</strong> this change lowers your Health Factor. Check this box
            to confirm you understand the increased risk — Apply Changes stays disabled until you
            do.
          </span>
        </label>
      )}
    </div>
  );
}

type CollateralManagementFormValues = z.input<typeof collateralManagementSchema>;

function CollateralPositionForm({
  portfolioId,
  portfolio,
  beforeSummary,
}: {
  portfolioId: string;
  portfolio: Portfolio;
  beforeSummary: ServiceResult<PortfolioSummary>;
}) {
  const update = usePortfolioStore((state) => state.update);
  const [preview, setPreview] = useState<ServiceResult<PortfolioSummary> | null>(null);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    resetField,
    formState: { errors },
  } = useForm<CollateralManagementFormValues, unknown, CollateralManagementInput>({
    resolver: zodResolver(collateralManagementSchema),
    mode: 'onChange',
    defaultValues: {
      collateral: portfolio.collateral,
      market: portfolio.market,
      protocol: {
        ...portfolio.protocol,
        maxLoanToValue: toPercentInput(portfolio.protocol.maxLoanToValue),
        liquidationThreshold: toPercentInput(portfolio.protocol.liquidationThreshold),
      },
    },
  });

  useEffect(() => {
    const subscription = watch(() => {
      setPreview(null);
      setRiskAcknowledged(false);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // M4-013 ("Prevent stale updates from overwriting newer state") — see
  // this file's own M4-013 header note. `portfolio.updatedAt` changes
  // whenever *any* form on this page (including this one's own Apply)
  // commits a change to the Store; clearing the preview here covers the
  // one case the `watch()` effect above cannot — a sibling form applying
  // a change to this same portfolio while this form's preview is open.
  useEffect(() => {
    setPreview(null);
    setRiskAcknowledged(false);
  }, [portfolio.updatedAt]);

  const onPreview = handleSubmit((data) => {
    setPreview(calculatePortfolioSummary({ ...portfolio, ...data }, 'manual'));
  });

  const onApply = handleSubmit((data) => {
    if (!canApply(preview, beforeSummary, riskAcknowledged)) return;
    const result = update(portfolioId, data);
    if (result.ok) {
      setPreview(null);
      setRiskAcknowledged(false);
      reset({
        collateral: data.collateral,
        market: data.market,
        protocol: {
          ...data.protocol,
          maxLoanToValue: toPercentInput(data.protocol.maxLoanToValue),
          liquidationThreshold: toPercentInput(data.protocol.liquidationThreshold),
        },
      });
    }
  });

  const marketQuote = getMarketQuote(portfolio);
  const protocolQuote = getProtocolQuote(portfolio);

  return (
    <form className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Collateral</legend>
        <input type="hidden" {...register('collateral.asset')} value="BTC" />
        <p className="text-xs text-muted-foreground">Asset: BTC</p>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Quantity <RequiredMark />
          </span>
          <input
            id="collateral.quantity"
            aria-required="true"
            type="number"
            step="any"
            {...register('collateral.quantity', { valueAsNumber: true })}
            aria-invalid={errors.collateral?.quantity ? 'true' : undefined}
            aria-describedby={errors.collateral?.quantity ? 'collateral.quantity-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.collateral?.quantity && (
          <span id="collateral.quantity-error" className="text-xs text-destructive">
            {errors.collateral.quantity.message}
          </span>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">Manual</span>
          <span>Last updated: {formatDateTime(portfolio.marketUpdatedAt)}</span>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Manual price (USD) <RequiredMark />
          </span>
          <input
            id="market.btcPriceUsd"
            aria-required="true"
            type="number"
            step="any"
            {...register('market.btcPriceUsd', { valueAsNumber: true })}
            aria-invalid={errors.market?.btcPriceUsd ? 'true' : undefined}
            aria-describedby={errors.market?.btcPriceUsd ? 'market.btcPriceUsd-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.market?.btcPriceUsd && (
          <span id="market.btcPriceUsd-error" className="text-xs text-destructive">
            {errors.market.btcPriceUsd.message}
          </span>
        )}
        <button
          type="button"
          onClick={() => resetField('market.btcPriceUsd')}
          className="self-start rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Reset price
        </button>
        {marketQuote?.freshness === 'stale' && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⚠ This price was last updated over 5 minutes ago and may be stale.
          </p>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Maximum LTV (%) <RequiredMark />
          </span>
          <input
            id="protocol.maxLoanToValue"
            aria-required="true"
            type="number"
            step="any"
            {...register('protocol.maxLoanToValue', {
              setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
            })}
            aria-invalid={errors.protocol?.maxLoanToValue ? 'true' : undefined}
            aria-describedby={
              errors.protocol?.maxLoanToValue ? 'protocol.maxLoanToValue-error' : undefined
            }
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
          <span className="text-xs text-muted-foreground">
            The most you can borrow against your collateral, as a percentage (e.g. 75 for 75%).
          </span>
        </label>
        {errors.protocol?.maxLoanToValue && (
          <span id="protocol.maxLoanToValue-error" className="text-xs text-destructive">
            {errors.protocol.maxLoanToValue.message}
          </span>
        )}
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Liquidation threshold (%) <RequiredMark />
          </span>
          <input
            id="protocol.liquidationThreshold"
            aria-required="true"
            type="number"
            step="any"
            {...register('protocol.liquidationThreshold', {
              setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
            })}
            aria-invalid={errors.protocol?.liquidationThreshold ? 'true' : undefined}
            aria-describedby={
              errors.protocol?.liquidationThreshold
                ? 'protocol.liquidationThreshold-error'
                : undefined
            }
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
          <span className="text-xs text-muted-foreground">
            The LTV at which your position becomes eligible for liquidation, as a percentage.
          </span>
        </label>
        {errors.protocol?.liquidationThreshold && (
          <span id="protocol.liquidationThreshold-error" className="text-xs text-destructive">
            {errors.protocol.liquidationThreshold.message}
          </span>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">Parameter source: Manual</span>
          {protocolQuote?.available && (
            <span>Last updated: {formatDateTime(protocolQuote.timestamp)}</span>
          )}
        </div>
        <input
          type="hidden"
          {...register('protocol.borrowApr', { valueAsNumber: true })}
          value={portfolio.protocol.borrowApr}
        />
        <input
          type="hidden"
          {...register('protocol.supplyApr', { valueAsNumber: true })}
          value={portfolio.protocol.supplyApr}
        />
      </fieldset>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent/40"
        >
          Preview Changes
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!canApply(preview, beforeSummary, riskAcknowledged)}
          aria-describedby={
            blockedByRiskAcknowledgment(preview, beforeSummary, riskAcknowledged)
              ? 'collateral-apply-blocked-hint'
              : undefined
          }
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Apply Changes
        </button>
      </div>

      {blockedByRiskAcknowledgment(preview, beforeSummary, riskAcknowledged) && (
        <p id="collateral-apply-blocked-hint" className="text-xs text-destructive">
          Apply Changes is disabled until you check the risk acknowledgment box below.
        </p>
      )}

      {preview && (
        <PreviewDiff
          before={beforeSummary}
          after={preview}
          riskAcknowledged={riskAcknowledged}
          onRiskAcknowledgedChange={setRiskAcknowledged}
        />
      )}
    </form>
  );
}

type DebtManagementFormValues = z.input<typeof debtManagementSchema>;

function DebtPositionForm({
  portfolioId,
  portfolio,
  beforeSummary,
}: {
  portfolioId: string;
  portfolio: Portfolio;
  beforeSummary: ServiceResult<PortfolioSummary>;
}) {
  const update = usePortfolioStore((state) => state.update);
  const [preview, setPreview] = useState<ServiceResult<PortfolioSummary> | null>(null);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<DebtManagementFormValues, unknown, DebtManagementInput>({
    resolver: zodResolver(debtManagementSchema),
    mode: 'onChange',
    defaultValues: {
      debt: portfolio.debt,
      protocol: {
        ...portfolio.protocol,
        borrowApr: toPercentInput(portfolio.protocol.borrowApr),
      },
    },
  });

  useEffect(() => {
    const subscription = watch(() => {
      setPreview(null);
      setRiskAcknowledged(false);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  // M4-013 — see `CollateralPositionForm`'s identical note above for the
  // full reasoning: clears a stale preview when a sibling form on this
  // same page applies a change to this same portfolio.
  useEffect(() => {
    setPreview(null);
    setRiskAcknowledged(false);
  }, [portfolio.updatedAt]);

  const onPreview = handleSubmit((data) => {
    setPreview(calculatePortfolioSummary({ ...portfolio, ...data }, 'manual'));
  });

  const onApply = handleSubmit((data) => {
    if (!canApply(preview, beforeSummary, riskAcknowledged)) return;
    const result = update(portfolioId, data);
    if (result.ok) {
      setPreview(null);
      setRiskAcknowledged(false);
      reset({
        debt: data.debt,
        protocol: { ...data.protocol, borrowApr: toPercentInput(data.protocol.borrowApr) },
      });
    }
  });

  const protocolQuote = getProtocolQuote(portfolio);

  return (
    <form className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Debt</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Asset <RequiredMark />
          </span>
          <select
            id="debt.asset"
            aria-required="true"
            {...register('debt.asset')}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="DAI">DAI</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Debt amount <RequiredMark />
          </span>
          <input
            id="debt.balance"
            aria-required="true"
            type="number"
            step="any"
            {...register('debt.balance', { valueAsNumber: true })}
            aria-invalid={errors.debt?.balance ? 'true' : undefined}
            aria-describedby={errors.debt?.balance ? 'debt.balance-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.debt?.balance && (
          <span id="debt.balance-error" className="text-xs text-destructive">
            {errors.debt.balance.message}
          </span>
        )}
        <p className="text-xs text-muted-foreground">
          Price: $1.00 (stablecoins are tracked at a fixed 1:1 value with the US dollar)
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span>
            Borrow rate (%) <RequiredMark />
          </span>
          <input
            id="protocol.borrowApr"
            aria-required="true"
            type="number"
            step="any"
            {...register('protocol.borrowApr', {
              setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
            })}
            aria-invalid={errors.protocol?.borrowApr ? 'true' : undefined}
            aria-describedby={errors.protocol?.borrowApr ? 'protocol.borrowApr-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
          <span className="text-xs text-muted-foreground">
            Your annual interest rate on this debt, as a percentage (e.g. 5 for 5%).
          </span>
        </label>
        {errors.protocol?.borrowApr && (
          <span id="protocol.borrowApr-error" className="text-xs text-destructive">
            {errors.protocol.borrowApr.message}
          </span>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">Parameter source: Manual</span>
          {protocolQuote?.available && (
            <span>Last updated: {formatDateTime(protocolQuote.timestamp)}</span>
          )}
        </div>
        <input
          type="hidden"
          {...register('protocol.maxLoanToValue', { valueAsNumber: true })}
          value={portfolio.protocol.maxLoanToValue}
        />
        <input
          type="hidden"
          {...register('protocol.liquidationThreshold', { valueAsNumber: true })}
          value={portfolio.protocol.liquidationThreshold}
        />
        <input
          type="hidden"
          {...register('protocol.supplyApr', { valueAsNumber: true })}
          value={portfolio.protocol.supplyApr}
        />
      </fieldset>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPreview}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent/40"
        >
          Preview Changes
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={!canApply(preview, beforeSummary, riskAcknowledged)}
          aria-describedby={
            blockedByRiskAcknowledgment(preview, beforeSummary, riskAcknowledged)
              ? 'debt-apply-blocked-hint'
              : undefined
          }
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Apply Changes
        </button>
      </div>

      {blockedByRiskAcknowledgment(preview, beforeSummary, riskAcknowledged) && (
        <p id="debt-apply-blocked-hint" className="text-xs text-destructive">
          Apply Changes is disabled until you check the risk acknowledgment box below.
        </p>
      )}

      {preview && (
        <PreviewDiff
          before={beforeSummary}
          after={preview}
          riskAcknowledged={riskAcknowledged}
          onRiskAcknowledgedChange={setRiskAcknowledged}
        />
      )}
    </form>
  );
}

export function PortfolioPageClient() {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );
  const saveStatus = usePortfolioStore((state) => state.saveStatus);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Portfolio</h1>
        <p className="text-sm text-muted-foreground">&ldquo;What do I own?&rdquo;</p>
      </div>

      {activePortfolioId === null || record === undefined ? (
        <p className="text-sm text-muted-foreground">
          No portfolio is currently selected.{' '}
          <Link href="/portfolios" className="underline">
            Select or create one
          </Link>
          .
        </p>
      ) : (
        <div key={activePortfolioId} className="flex flex-col gap-8">
          <p className="text-xs text-muted-foreground" role="status">
            {formatSaveStatus(saveStatus)}
          </p>
          <CalculationErrorBanner
            portfolioId={activePortfolioId}
            portfolio={record.portfolio}
            summary={record.summary}
          />
          <LiveAaveDataPanel />
          <PortfolioDetailsForm portfolioId={activePortfolioId} portfolio={record.portfolio} />
          <CollateralPositionForm
            portfolioId={activePortfolioId}
            portfolio={record.portfolio}
            beforeSummary={record.summary}
          />
          <DebtPositionForm
            portfolioId={activePortfolioId}
            portfolio={record.portfolio}
            beforeSummary={record.summary}
          />
        </div>
      )}
    </div>
  );
}
