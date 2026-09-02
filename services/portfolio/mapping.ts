/**
 * Portfolio Mapping Utilities — 06_TASKS.md M3-004.
 *
 * Explicit mapping functions between the persistence-layer Portfolio
 * shape, the application-layer Portfolio shape, and the Formula Engine's
 * own `PortfolioInput` (`./models.ts` documents why both are currently
 * minimal). Satisfies M3-004's 4 Requirements directly:
 *   - "Keep mappings explicit": every field is read and assigned by name,
 *     never spread or bulk-copied.
 *   - "Validate required fields": enforced at the persistence →
 *     application boundary, where data may legitimately be missing.
 *   - "Avoid unsafe type casting": no `as` casts anywhere in this file —
 *     every value used in a constructed object comes from a helper
 *     function whose own return type already proves it's valid, not from
 *     asserting an unchecked value's type.
 *   - "Do not format values for display": every value here is a raw
 *     number/string, exactly as the Engine expects — no currency,
 *     percentage, or date formatting.
 *
 * `MappingResult<T>` (not `ServiceResult<T>` from M3-002) is used here
 * deliberately: `ServiceResult`'s metadata (`engineVersion`,
 * `formulaVersion`, a calculation timestamp) describes an Engine
 * *calculation*, and this file performs none — it only reshapes data.
 * Forcing an `engineVersion` onto a mapping operation that never calls
 * the Engine would mean fabricating a value with no real source, which
 * is its own kind of invention. `MappingResult` reuses `ApplicationError`
 * (M3-003) for its error shape, so a Service that calls this mapping
 * (M3-005 onward) can pass a mapping failure's `errors` straight into a
 * real `ServiceResult` failure at the point it actually does have Engine
 * metadata to report.
 *
 * `MappingResult<T>` itself now lives in `services/shared/mappingResult.ts`
 * (relocated at M3-007, Market Data Service — the second consumer that
 * needed the identical type, the promotion trigger this file originally
 * anticipated). Re-exported here unchanged so nothing importing it from
 * this module's public API needs to change.
 */
import {
  calculateDebtAssetValue,
  deriveAaveV4DebtAfterRepayment,
  type FormulaResult,
  type PortfolioInput,
  projectProtocolDebt,
} from '@/engine';

import { type ApplicationError, createApplicationError } from '../shared/errors';
import {
  type FormulaStep,
  formulaStep,
  optionsFromTracked,
  type TrackedFormulaVersion,
} from '../shared/formulaStep';
import type { MappingResult } from '../shared/mappingResult';
import { createServiceFailure, type ServiceFailure } from '../shared/result';
import type {
  AaveV4DebtState,
  ApplicationPortfolio,
  PersistenceCollateralPosition,
  PersistenceDebtPosition,
  PersistenceMarketPrices,
  PersistencePortfolio,
  PersistenceProtocolParameters,
} from './models';

export type { MappingFailure, MappingResult, MappingSuccess } from '../shared/mappingResult';

function readRequiredNumber(
  value: number | null | undefined,
  code: string,
  message: string,
  errors: ApplicationError[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(createApplicationError('validation', code, message));
    return undefined;
  }
  return value;
}

function readRequiredNonEmptyString(
  value: string | null | undefined,
  code: string,
  message: string,
  errors: ApplicationError[],
): string | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(createApplicationError('validation', code, message));
    return undefined;
  }
  return value;
}

function mapCollateralPosition(
  persistence: PersistenceCollateralPosition | null | undefined,
  errors: ApplicationError[],
): ApplicationPortfolio['collateral'] | undefined {
  const isBtc = persistence?.asset === 'BTC';
  if (!isBtc) {
    errors.push(
      createApplicationError(
        'validation',
        'PORTFOLIO_COLLATERAL_ASSET_INVALID',
        'Collateral asset must be BTC.',
      ),
    );
  }
  const quantity = readRequiredNumber(
    persistence?.quantity,
    'PORTFOLIO_COLLATERAL_QUANTITY_MISSING',
    'Collateral quantity is required.',
    errors,
  );

  if (!isBtc || quantity === undefined) return undefined;
  return { asset: 'BTC', quantity };
}

function mapDebtPosition(
  persistence: PersistenceDebtPosition | null | undefined,
  errors: ApplicationError[],
): ApplicationPortfolio['debt'] | undefined {
  const asset = readRequiredNonEmptyString(
    persistence?.asset,
    'PORTFOLIO_DEBT_ASSET_MISSING',
    'Debt asset is required.',
    errors,
  );
  const balance = readRequiredNumber(
    persistence?.balance,
    'PORTFOLIO_DEBT_BALANCE_MISSING',
    'Debt balance is required.',
    errors,
  );

  if (asset === undefined || balance === undefined) return undefined;
  return { asset, balance };
}

function mapMarketPrices(
  persistence: PersistenceMarketPrices | null | undefined,
  errors: ApplicationError[],
): ApplicationPortfolio['market'] | undefined {
  const btcPriceUsd = readRequiredNumber(
    persistence?.btcPriceUsd,
    'PORTFOLIO_MARKET_PRICE_MISSING',
    'Current BTC price is required.',
    errors,
  );

  if (btcPriceUsd === undefined) return undefined;
  return { btcPriceUsd };
}

function mapProtocolParameters(
  persistence: PersistenceProtocolParameters | null | undefined,
  errors: ApplicationError[],
): ApplicationPortfolio['protocol'] | undefined {
  const maxLoanToValue = readRequiredNumber(
    persistence?.maxLoanToValue,
    'PORTFOLIO_PROTOCOL_MAX_LTV_MISSING',
    'Protocol maximum LTV is required.',
    errors,
  );
  const liquidationThreshold = readRequiredNumber(
    persistence?.liquidationThreshold,
    'PORTFOLIO_PROTOCOL_LIQUIDATION_THRESHOLD_MISSING',
    'Protocol liquidation threshold is required.',
    errors,
  );
  const borrowApr = readRequiredNumber(
    persistence?.borrowApr,
    'PORTFOLIO_PROTOCOL_BORROW_APR_MISSING',
    'Protocol borrow APR is required.',
    errors,
  );
  const supplyApr = readRequiredNumber(
    persistence?.supplyApr,
    'PORTFOLIO_PROTOCOL_SUPPLY_APR_MISSING',
    'Protocol supply APR is required.',
    errors,
  );

  if (
    maxLoanToValue === undefined ||
    liquidationThreshold === undefined ||
    borrowApr === undefined ||
    supplyApr === undefined
  ) {
    return undefined;
  }
  return { maxLoanToValue, liquidationThreshold, borrowApr, supplyApr };
}

/**
 * Persistence → Application — 06_TASKS.md M3-004. The only mapping step
 * where "Validate required fields" applies: persisted data may
 * legitimately be missing or malformed, so this is where that gets
 * caught, aggregating every field-level problem into `errors` rather
 * than stopping at the first one (mirroring `ServiceFailure.errors`'
 * plural design from M3-002/M3-003).
 */
export function mapPersistencePortfolioToApplicationPortfolio(
  persistence: PersistencePortfolio,
): MappingResult<ApplicationPortfolio> {
  const errors: ApplicationError[] = [];

  const collateral = mapCollateralPosition(persistence.collateral, errors);
  const debt = mapDebtPosition(persistence.debt, errors);
  const market = mapMarketPrices(persistence.market, errors);
  const protocol = mapProtocolParameters(persistence.protocol, errors);

  if (
    collateral === undefined ||
    debt === undefined ||
    market === undefined ||
    protocol === undefined
  ) {
    return { ok: false, errors };
  }

  return { ok: true, data: { collateral, debt, market, protocol } };
}

/**
 * Application → Engine input — 06_TASKS.md M3-004. Infallible: by the
 * time a value is a valid `ApplicationPortfolio`, every field is already
 * an Engine-compatible type (reused directly from `@/engine`, see
 * `./models.ts`), so there is nothing left to validate here. The value
 * of this function is structural, not defensive: it is the one place
 * that reads only the 4 Engine-relevant fields and nothing else — once
 * M4-001 extends `ApplicationPortfolio` with identity/description/
 * currency/settings/timestamp fields, this is what keeps those fields
 * from leaking into the Engine (M3-004's own DoD), by construction.
 *
 * **Canonical V4 debt balance (V4 Readiness Audit §12 Stage 9).** Every
 * caller of this function (`calculatePortfolioSummary`, `simulateScenario`,
 * and every other Service that reads `PortfolioInput.debt.balance` —
 * `services/loop/strategy.ts`, `services/exit/plan.ts`,
 * `services/recommendation/*`, `services/portfolio/exposure.ts`,
 * `services/portfolio/interestBreakdown.ts`) was, before this stage,
 * silently reading the legacy `ApplicationPortfolio.debt.balance` field
 * even for a `protocolVersion: 'v4'` portfolio — a field Stage 6/7's live
 * sync never writes to, so it can freely disagree with the portfolio's
 * real on-chain V4 debt. When `protocolVersion === 'v4'` AND a real
 * `v4DebtState` (Stage 6/7) is present, `debt.balance` below is instead
 * `v4DebtState.drawnDebt + v4DebtState.premiumDebt` — the portfolio's
 * actual current total V4 debt. This is a plain sum of two already-known
 * current-state numbers, not a re-derivation of any accrual formula —
 * the same "not V4 math, just reading real inputs" discipline
 * `services/simulation/scenario.ts`'s own `currentTotalDebt` (Stage 8)
 * already established (that file's own duplicate of this same sum was
 * removed this stage now that it's centralized here).
 *
 * **Still infallible by design** — when `protocolVersion === 'v4'` but
 * `v4DebtState` is `undefined`, this function returns the legacy
 * `debt.balance` unchanged rather than failing. The explicit "fail
 * closed instead of silently using V3 debt semantics" requirement is
 * enforced by callers that have real `ServiceResult` failure metadata to
 * report from, via the shared `checkAaveV4DebtStateAvailable` guard below
 * (promoted at Stage 10 from `services/portfolio/summary.ts`'s own
 * original Stage 9 inline check): `calculatePortfolioSummary` (covering
 * the Portfolio Store's own displayed summary, and — since
 * `simulateScenario` calls it first for its baseline, for every scenario
 * type — both Simulation branches too), `services/loop/strategy.ts`,
 * `services/portfolio/interestBreakdown.ts`,
 * `services/recommendation/targetHealthFactorActions.ts`, and
 * `services/recommendation/recommendations.ts` all now call it directly.
 * `services/exit/plan.ts` needs no separate call — both its "before" and
 * "after" summaries already go through `calculatePortfolioSummary`, so it
 * inherits the guard transitively. `services/portfolio/exposure.ts` needs
 * no guard at all — `calculateExposure` only reads `collateral`/`market`,
 * never `debt`.
 *
 * **Authoritative V4 debt USD valuation (V4 Readiness Audit §12 P1-D3).**
 * The V4 branch no longer treats `drawnDebt + premiumDebt` (a raw token
 * quantity) as USD directly — that was the implicit "1 debt token = $1"
 * assumption this whole stage exists to remove. When `v4DebtState.debtAssetPriceUsd`
 * (P1-D1's authoritative Spoke-oracle price, threaded through by
 * `hooks/useAaveV4LiveSync.ts`) is present, this calls the canonical
 * `calculateDebtAssetValue` (P1-D2) — `quantity × price`, the ONLY place
 * in this codebase that arithmetic happens — and returns its USD result.
 * `DebtPosition.balance`'s MEANING is unchanged by this: it is still "the
 * portfolio's current total debt, in USD," for every downstream Engine
 * consumer, V3 and V4 alike; only how V4 arrives at that number changed.
 *
 * **Manual V4 mode is deliberately exempt, unchanged.** `debtAssetPriceUsd`
 * is `undefined` for every manual `v4DebtState` (no UI ever sets it — see
 * `AaveV4DebtState`'s own doc comment) — this function falls back to the
 * raw quantity sum in that case, exactly its pre-P1-D3 behavior, per this
 * stage's own explicit scope ("manual V4 retains the existing $1
 * assumption for now"). The same fallback also covers the structurally
 * unreachable case where `calculateDebtAssetValue` itself fails despite a
 * defined price (P1-D1 already validates positivity/finiteness before
 * ever storing `debtAssetPriceUsd`, and `checkAaveV4DebtAssetPriceAvailable`
 * below fails the calculation closed at every real call site before this
 * function ever runs for a `'live'`-sourced portfolio) — kept as defense
 * in depth, not a designed behavior.
 *
 * **`resolveCanonicalDebtBalance` (V4 Readiness Audit §12 Stage 16)** —
 * the sum below was extracted into its own named, exported function so
 * every OTHER place in the codebase that needs "the portfolio's real
 * current total debt" (not an Engine call, just this same plain sum) can
 * reuse the identical, single source of truth instead of re-deriving it
 * — Stage 16's own audit found several UI/Store consumers
 * (`DebtPositionForm`'s edit delta, `exitPlannerStore`'s partial-repayment
 * target, `ApplyLoopAsSimulation`'s simulation delta, Scenario Builder
 * validation, the Portfolios list "No debt" badge, the Dashboard's debt
 * quantity display, and CSV/exit-plan export) that had each been reading
 * the legacy `debt.balance` field directly, independent of this function,
 * and could therefore disagree with it. No new V4 math: this is the exact
 * same `drawnDebt + premiumDebt` sum `mapApplicationPortfolioToEngineInput`
 * itself already performed — moving it to its own function changes no
 * behavior here, only makes the "current total debt" derivation reusable
 * and impossible to duplicate incorrectly elsewhere. Stays infallible,
 * for the same reason `mapApplicationPortfolioToEngineInput` itself does
 * (see this comment's own "Still infallible by design" section above) —
 * callers that need fail-closed behavior on a missing `v4DebtState` still
 * enforce that themselves, exactly as every existing caller of this
 * chokepoint already does.
 */
export function resolveCanonicalDebtBalance(application: ApplicationPortfolio): number {
  if (application.protocolVersion !== 'v4' || application.v4DebtState === undefined) {
    return application.debt.balance;
  }

  const { v4DebtState } = application;
  const quantity = v4DebtState.drawnDebt + v4DebtState.premiumDebt;

  if (v4DebtState.debtAssetPriceUsd === undefined) {
    return quantity;
  }

  const valued = calculateDebtAssetValue(quantity, v4DebtState.debtAssetPriceUsd);
  return valued.ok ? valued.value : quantity;
}

export function mapApplicationPortfolioToEngineInput(
  application: ApplicationPortfolio,
): PortfolioInput {
  return {
    collateral: application.collateral,
    debt: { asset: application.debt.asset, balance: resolveCanonicalDebtBalance(application) },
    market: application.market,
    protocol: application.protocol,
  };
}

/**
 * V4 fail-closed guard (V4 Readiness Audit §12 Stage 10) — the same check
 * `services/portfolio/summary.ts` originated inline at Stage 9, now shared
 * so every other debt/rate-sensitive Service can enforce the identical
 * "no synced V4 state, no calculation" rule instead of duplicating it (or,
 * worse, omitting it and silently inheriting `mapApplicationPortfolioToEngineInput`'s
 * own legacy `debt.balance` fallback — see that function's own doc comment
 * on why it deliberately stays infallible). Requires a `tracked` value
 * from the caller's own first successful Engine call — `ServiceMetadata.engineVersion`
 * must always come from a real Engine call (`services/shared/result.ts`'s
 * own doc comment), never a fabricated constant — so this is always called
 * after that first call succeeds, mirroring `calculatePortfolioSummary`'s
 * own original placement (right after Collateral Value, the one step that
 * never reads `debt` at all).
 */
export function checkAaveV4DebtStateAvailable(
  application: ApplicationPortfolio,
  tracked: TrackedFormulaVersion,
  sourceStatus: string,
): ServiceFailure | null {
  if (application.protocolVersion !== 'v4' || application.v4DebtState !== undefined) {
    return null;
  }
  const error: ApplicationError = createApplicationError(
    'calculation',
    'AAVE_V4_DEBT_STATE_MISSING',
    'This calculation requires Aave V4 debt data (drawn debt, premium debt, base rate, risk premium) for this portfolio, but none is available yet — sync a live position or enter it manually.',
  );
  return createServiceFailure([error], optionsFromTracked(sourceStatus, tracked));
}

/**
 * V4 authoritative debt-price fail-closed guard (V4 Readiness Audit §12
 * P1-D3) — same shape and same calling convention as
 * `checkAaveV4DebtStateAvailable` above (called immediately after it, at
 * the same 5 production entry points), for a narrower condition: a
 * `'live'`-sourced `v4DebtState` that is missing its authoritative
 * `debtAssetPriceUsd`. This should only be reachable for a live sync that
 * has not yet completed a P1-D3-era fetch (e.g. a portfolio whose
 * `v4DebtState` was written before this stage shipped, or a live sync
 * that is still loading) — never a designed steady state, so it fails
 * closed rather than letting `resolveCanonicalDebtBalance` silently fall
 * back to the raw-quantity (implicit-$1) sum for data that claims to be
 * live-authoritative.
 *
 * **Deliberately does NOT fire for `'manual'` (or unset) `v4DebtStateSource`.**
 * Manual/hypothetical V4 mode has no oracle to read a price from and, per
 * this stage's own explicit scope, keeps its existing implicit-$1
 * behavior unchanged — failing this calculation closed for every manual
 * V4 portfolio would be a real behavior regression, not a safety
 * improvement (manual mode was never claiming live-protocol accuracy in
 * the first place). Checking `v4DebtStateSource` — not just "is a price
 * present" — is what distinguishes "a live sync is expected to have
 * supplied one and hasn't" from "this was always manual, by design."
 */
export function checkAaveV4DebtAssetPriceAvailable(
  application: ApplicationPortfolio,
  tracked: TrackedFormulaVersion,
  sourceStatus: string,
): ServiceFailure | null {
  if (
    application.protocolVersion !== 'v4' ||
    application.v4DebtState === undefined ||
    application.v4DebtStateSource !== 'live' ||
    application.v4DebtState.debtAssetPriceUsd !== undefined
  ) {
    return null;
  }
  const error: ApplicationError = createApplicationError(
    'calculation',
    'AAVE_V4_DEBT_ASSET_PRICE_MISSING',
    'This calculation requires the authoritative Aave V4 debt-asset oracle price for this portfolio, but the live-synced debt data does not include one yet — refresh the live position.',
  );
  return createServiceFailure([error], optionsFromTracked(sourceStatus, tracked));
}

/**
 * V4 fail-closed guard (V4 Readiness Audit §12 Stage 23D) — the same
 * shape and same reasoning as `checkAaveV4DebtStateAvailable` above, now
 * for `v4CollateralRisk` (Stage 23C). Health Factor, liquidation price/
 * distance/buffer, and borrow-capacity calculations all need V4's real
 * `collateralFactor` (Stage 23B's authoritative Solidity trace:
 * `Spoke.sol`'s `_processUserAccountData`/`Spoke.borrow()` — V4 has no
 * V3-shaped `maxLoanToValue`/`liquidationThreshold` split at all, only
 * this one parameter governs both). A V4 portfolio with no synced
 * `v4CollateralRisk` has no real source for that parameter — this fails
 * the calculation closed rather than silently falling back to
 * `protocol.liquidationThreshold`/`maxLoanToValue` (the legacy V3
 * scalars, mathematically unrelated to V4's real risk parameter — see
 * `resolveRiskCapacityFraction` below).
 *
 * Checks `v4CollateralRisk !== undefined` (object presence), never
 * `collateralFactor`'s own truthiness — a real, synced `collateralFactor: 0`
 * (a genuinely uninitialized or zero-weight on-chain dynamic config, see
 * `AaveV4CollateralRiskConfig`'s own doc comment) must pass this guard
 * and be treated as real configuration, not as "missing."
 */
export function checkAaveV4CollateralRiskAvailable(
  application: ApplicationPortfolio,
  tracked: TrackedFormulaVersion,
  sourceStatus: string,
): ServiceFailure | null {
  if (application.protocolVersion !== 'v4' || application.v4CollateralRisk !== undefined) {
    return null;
  }
  const error: ApplicationError = createApplicationError(
    'calculation',
    'AAVE_V4_COLLATERAL_RISK_MISSING',
    'This calculation requires Aave V4 collateral-risk data (collateral factor, bound at the user’s own dynamic-config snapshot) for this portfolio, but none is available yet — sync a live position or enter it manually.',
  );
  return createServiceFailure([error], optionsFromTracked(sourceStatus, tracked));
}

/**
 * The single risk-capacity fraction Health Factor, liquidation price/
 * distance/buffer, and borrow-capacity all weight collateral by — V4
 * Readiness Audit §12 Stage 23D. V3: `protocol.liquidationThreshold`,
 * completely unchanged. V4: `v4CollateralRisk.collateralFactor` — a
 * genuinely different on-chain concept (Stage 23B: V4 has no separate
 * max-LTV/liquidation-threshold pair; `collateralFactor` alone governs
 * both borrow capacity and liquidation eligibility), never a reuse or
 * reinterpretation of the V3 field.
 *
 * **Deliberately returns `null`, never a silent legacy-field fallback,
 * when V4 collateral risk is unavailable.** Unlike
 * `resolveCanonicalDebtBalance` above (which stays infallible by
 * design, deferring fail-closed behavior to its own caller-enforced
 * guard), this function's callers are expected to have already called
 * `checkAaveV4CollateralRiskAvailable` and returned on failure — by the
 * time this runs for a V4 portfolio, `v4CollateralRisk` is guaranteed
 * present, so the `null` branch here is unreachable in practice, kept
 * only so this function's own type signature can never lie about V4
 * unavailability the way a bare `!` assertion would.
 */
export function resolveRiskCapacityFraction(application: ApplicationPortfolio): number | null {
  if (application.protocolVersion !== 'v4') {
    return application.protocol.liquidationThreshold;
  }
  return application.v4CollateralRisk?.collateralFactor ?? null;
}

/**
 * Display-shape resolution for the risk-capacity parameter — V4
 * Readiness Audit §12 Stage 23E. Every consumer that shows "Max LTV"/
 * "Liquidation Threshold" (Dashboard's Portfolio Composition, the
 * Portfolio page's Collateral form stat, the shared Loop Builder/Exit
 * Planner `StrategyAssumptionsPanel`, Simulation's `SimulationAssumptions`,
 * and 4 CSV/JSON exporters) previously read `portfolio.protocol.maxLoanToValue`/
 * `.liquidationThreshold` unconditionally, regardless of `protocolVersion`
 * — for a V4 portfolio this rendered a meaningless V3 number under a
 * V3-only label, since V4 has no such pair (Stage 23B: `collateralFactor`
 * alone governs both). This is the single shared resolver every one of
 * those consumers now calls instead of re-deriving the same
 * `protocolVersion`/`v4CollateralRisk` branch locally — "reuse canonical
 * Service results, don't duplicate formulas" applies to display-shape
 * resolution exactly as much as to numeric formulas.
 *
 * **Deliberately not a formatted string** — `services/portfolio/mapping.ts`'s
 * own header comment ("do not format values for display") applies here
 * too; every consumer still does its own local `formatPercent`/CSV-cell
 * formatting, only the underlying raw values and V3-vs-V4 branch are
 * shared.
 *
 * **Distinguishes "available" from "unavailable" for V4** the same way
 * `checkAaveV4CollateralRiskAvailable` does (object-presence, not
 * truthiness) — a real, synced `collateralFactor: 0` is `v4Available`
 * with `collateralFactor: 0`, never conflated with `v4Unavailable`.
 */
export type RiskCapacityDisplay =
  | { kind: 'v3'; maxLoanToValue: number; liquidationThreshold: number }
  | { kind: 'v4Available'; collateralFactor: number }
  | { kind: 'v4Unavailable' };

export function resolveRiskCapacityDisplay(application: ApplicationPortfolio): RiskCapacityDisplay {
  if (application.protocolVersion !== 'v4') {
    return {
      kind: 'v3',
      maxLoanToValue: application.protocol.maxLoanToValue,
      liquidationThreshold: application.protocol.liquidationThreshold,
    };
  }
  return application.v4CollateralRisk === undefined
    ? { kind: 'v4Unavailable' }
    : { kind: 'v4Available', collateralFactor: application.v4CollateralRisk.collateralFactor };
}

/**
 * Display-shape resolution for `protocol.supplyApr` — V4 Readiness Audit
 * §12 P1-1. `protocol.supplyApr` is a required, V3-shaped scalar (Engine
 * `ProtocolParameters`, persistence `PORTFOLIO_PROTOCOL_SUPPLY_APR_MISSING`
 * fails the whole portfolio load if absent) with no V4-aware provenance
 * of its own — unlike `v4DebtState`/`v4CollateralRisk`, there is no
 * `'manual' | 'live'` source flag attached directly to this field. Before
 * this stage, every consumer read it unconditionally, so a portfolio that
 * had ever been V3 (or imported/defaulted) kept showing that number
 * forever after switching to live V4, even though it never came from V4
 * at all.
 *
 * **Verified against the pinned V4 boundary — this is Path B, not a
 * staleness window.** No function anywhere in `IHub`/`IHubBase`/`ISpoke`
 * (`aave/aave-v4` commit `2524fe4018a42750300e114f2a8c4355df62a878`, the
 * same primary source `infrastructure/protocols/aave/v4/abi.ts` is
 * already pinned to) exposes a supply-side interest rate. V4's Hub
 * accounts for supply via a shares/exchange-rate model (`add`/`remove`/
 * `previewAddByShares`/`previewAddByAssets`), not a point-in-time rate
 * field the way V3's Pool exposes `liquidityRate` — there is no
 * authoritative single-read V4 supply APR for this adapter to ever fetch,
 * so unlike `resolveRiskCapacityDisplay`'s `v4Unavailable` (a genuinely
 * fetchable value, unavailable only until synced), this is a permanent
 * "unavailable" for any V4 mode without an explicit human assertion, not
 * a sync-pending state.
 *
 * **Reuses `v4CollateralRiskSource`, the existing BTC-collateral-side V4
 * provenance flag, rather than inventing a new one** — Supply APR is a
 * collateral-side (BTC-supply) concept, and this data model has no
 * `supplyApr`-specific source flag to key off instead. `'manual'` is the
 * only V4 mode where the user has taken deliberate ownership of this
 * portfolio's V4 collateral-side data, so it is the only V4 case where
 * `protocol.supplyApr` is still treated as an honest, user-asserted
 * value — this preserves manual V4's existing semantics unchanged, per
 * this stage's own scope. Both `'live'` and not-yet-synced (source is
 * neither `'manual'` nor `'live'`) resolve to unavailable, so a V3→V4
 * transition — or a portfolio whose collateral-risk live fetch has never
 * once succeeded — cannot keep presenting a stale inherited number
 * either; there is no partial-trust state in between.
 *
 * **Never mutates or clears `protocol.supplyApr` itself** — the
 * underlying field stays exactly as every other reader (Engine
 * validation, persistence, the equality comparator) already requires;
 * this is a presentation-layer gate only. Every consumer must call this
 * before displaying/exporting the raw field for a portfolio that might be
 * V4 — never read `protocol.supplyApr` directly in that context.
 */
export type SupplyAprDisplay = { kind: 'available'; supplyApr: number } | { kind: 'unavailable' };

export function resolveSupplyAprDisplay(application: ApplicationPortfolio): SupplyAprDisplay {
  const isUntrustedV4 =
    application.protocolVersion === 'v4' && application.v4CollateralRiskSource !== 'manual';
  return isUntrustedV4
    ? { kind: 'unavailable' }
    : { kind: 'available', supplyApr: application.protocol.supplyApr };
}

/**
 * V4 interest cost via the real V4 accrual engine, over an arbitrary
 * holding period (V4 Readiness Audit §12 Stage 10, generalized at Stage
 * 11) — replaces a legacy `calculateDailyInterest`/`calculateMonthlyInterest`/
 * `calculateAnnualInterest(debtValue, protocol.borrowApr)` call for a V4
 * portfolio with live `v4DebtState`. `protocol.borrowApr` was always
 * rate-questionable for V4 (see this file's own header comment): it is a
 * single V3-shaped scalar with no defined relationship to V4's real
 * two-parameter rate model (`baseDrawnApr` + `riskPremium`, which compound
 * differently — see `AaveV4DebtState`'s own doc comment in `./models.ts`).
 * This projects the portfolio's real, currently-effective V4 rates forward
 * `elapsedDays` through the same `projectProtocolDebt` V4 dispatch every
 * other V4 projection in this codebase already uses (Stage 8/9), and
 * reports the difference between the projected and current total debt as
 * the cost over that period — not a new formula, just the Engine's own
 * already-validated accrual math read back a second time
 * (`AaveV4DebtProjection.totalDebt` is Engine-computed, never manually
 * summed here). `services/portfolio/interestBreakdown.ts` (Stage 11) calls
 * this with `elapsedDays: 1`/`30` for Daily/Monthly, the same real
 * `elapsedDays`-driven projection rather than a hand-derived
 * daily-figure-times-30 scaling — matching this file's own "not a
 * re-derivation of any accrual formula" discipline.
 */
export function projectAaveV4InterestCost(
  v4DebtState: AaveV4DebtState,
  elapsedDays: number,
): FormulaResult<number> {
  const projection = projectProtocolDebt({
    protocolVersion: 'v4',
    drawnDebt: v4DebtState.drawnDebt,
    premiumDebt: v4DebtState.premiumDebt,
    baseDrawnApr: v4DebtState.baseDrawnApr,
    riskPremium: v4DebtState.riskPremium,
    elapsedDays,
  });
  if (!projection.ok) return projection;

  const currentTotalDebt = v4DebtState.drawnDebt + v4DebtState.premiumDebt;
  return { ...projection, value: projection.value.totalDebt - currentTotalDebt };
}

/**
 * The Stage 10 entry point, unchanged — a thin `elapsedDays: 365`
 * specialization of `projectAaveV4InterestCost` above.
 *
 * **Stays a raw debt-token-quantity delta, deliberately (V4 Readiness
 * Audit §12 P1-D3).** `deriveAaveV4EffectiveBorrowRate` below divides
 * this value by the also-raw `drawnDebt + premiumDebt` sum to compute a
 * price-independent RATE ratio — converting this function's own output to
 * USD would silently scale that rate by `debtAssetPriceUsd`, corrupting
 * it. Callers that need a USD dollar figure (`services/portfolio/summary.ts`'s
 * `interestCost`, `services/simulation/scenario.ts`'s price-branch
 * `debtCost`) use `projectAaveV4AnnualInterestCostUsd` below instead — a
 * genuine defect found while reviewing that stage: before this fix, both
 * used this function's raw output directly as a dollar figure.
 */
export function projectAaveV4AnnualInterestCost(
  v4DebtState: AaveV4DebtState,
): FormulaResult<number> {
  return projectAaveV4InterestCost(v4DebtState, 365);
}

/**
 * V4 Readiness Audit §12 P1-D3 — USD-denominated wrapper around
 * `projectAaveV4InterestCost`. That function's own return value is a raw
 * debt-TOKEN quantity delta (interest accrued in the debt asset's own
 * native units); every consumer of an Interest Cost figure elsewhere in
 * this codebase (`calculateAnnualInterest`/`calculateDailyInterest`/
 * `calculateMonthlyInterest`, all taking a USD `debtValue`) expects a
 * dollar figure. Converts via the canonical `calculateDebtAssetValue`
 * (P1-D2) — the same single place arithmetic happens, never duplicated —
 * with the same manual-mode fallback `resolveCanonicalDebtBalance`
 * (`services/portfolio/mapping.ts`) uses: the raw delta unchanged when no
 * authoritative price is available (`debtAssetPriceUsd` is `undefined`
 * for every manual `v4DebtState`, by design). Used by
 * `services/portfolio/interestBreakdown.ts`'s Daily/Monthly breakdown.
 */
export function projectAaveV4InterestCostUsd(
  v4DebtState: AaveV4DebtState,
  elapsedDays: number,
): FormulaResult<number> {
  const costStep = projectAaveV4InterestCost(v4DebtState, elapsedDays);
  if (!costStep.ok) return costStep;
  if (v4DebtState.debtAssetPriceUsd === undefined) return costStep;
  const valued = calculateDebtAssetValue(costStep.value, v4DebtState.debtAssetPriceUsd);
  return valued.ok ? { ...costStep, value: valued.value } : costStep;
}

/**
 * The USD counterpart to `projectAaveV4AnnualInterestCost` above — a thin
 * `elapsedDays: 365` specialization of `projectAaveV4InterestCostUsd`.
 * Used by `services/portfolio/summary.ts`'s `interestCost` and
 * `services/simulation/scenario.ts`'s price-branch `debtCost`.
 */
export function projectAaveV4AnnualInterestCostUsd(
  v4DebtState: AaveV4DebtState,
): FormulaResult<number> {
  return projectAaveV4InterestCostUsd(v4DebtState, 365);
}

/**
 * V4 effective borrow rate (V4 Readiness Audit §12 Stage 15) — the single
 * canonical rate every V4 consumer that currently reads the legacy V3
 * scalar `portfolio.protocol.borrowApr` (Dashboard's "Current Borrow
 * Rate"/"Borrow APR", the Portfolio page's Debt form "Borrow rate" stat,
 * Loop Builder's cost/monthly-interest projections, Recommendation
 * Center's loop recommendation) must use instead for a V4 portfolio.
 *
 * **Deliberately NOT new rate math** — `AaveV4DebtState`'s two real rate
 * components (`baseDrawnApr` applied to drawn debt, `riskPremium` applied
 * only as a markup on newly-accrued drawn interest — see
 * `projectAaveV4Debt`'s own header comment) never collapse into one
 * blended scalar anywhere in the Engine, by design (`AaveV4DebtProjection`'s
 * own doc comment: "No single normalized debt output" — the same
 * reasoning extends to rate). Rather than inventing a parallel blending
 * formula, this reads the blend back out of `projectAaveV4AnnualInterestCost`
 * (Stage 10/11's own already-validated, already-used annual-cost
 * projection): the constant simple annual rate that would produce the
 * exact same real dollar cost this Engine call already reports is, by
 * definition, `annualCost / currentTotalDebt` — reusing trusted output,
 * not re-deriving trusted input.
 *
 * **Zero current debt is handled explicitly, not divided by.** When
 * `drawnDebt + premiumDebt === 0`, `projectAaveV4Debt`'s own accrual
 * model guarantees `drawnInterestAccrued` (and therefore all premium
 * growth, which is driven entirely off it) is exactly zero regardless of
 * the rate parameters — so `annualCost` is always `0` here too, making
 * `annualCost / totalDebt` an undefined `0/0`, not a meaningful blend.
 * `baseDrawnApr` alone is returned instead: it is still a real,
 * currently-effective V4 rate component read straight from the synced
 * `v4DebtState` (never `protocol.borrowApr`), and is the correct
 * "rate a marginal new borrow would start accruing at" value — premium
 * only ever builds on top of drawn interest that has not accrued yet.
 * This keeps Loop Builder usable for a V4 portfolio starting a fresh
 * loop from zero debt, the same "current, real, just not blended" input
 * every other zero-debt case in this codebase already prefers over
 * failing closed on a legitimate starting state.
 *
 * **Still fails closed exactly like every other V4 rate/cost path** —
 * `projectAaveV4AnnualInterestCost`'s own validation (negative balances,
 * invalid rates) propagates through `formulaStep` unchanged; this
 * function adds no new failure modes and swallows none.
 *
 * **`tracked` accepts `null`**, same as `formulaStep` itself — most
 * callers already have a real prior Engine call's tracked version to
 * pass (e.g. `beforeSummary.metadata`), but `services/recommendation/recommendations.ts`
 * needs to derive this rate *before* its own first Engine call (to build
 * a corrected `engineInput.protocol.borrowApr` ahead of time), so `null`
 * lets this be that first call instead of requiring a fabricated one.
 */
export function deriveAaveV4EffectiveBorrowRate(
  v4DebtState: AaveV4DebtState,
  tracked: TrackedFormulaVersion | null,
  sourceStatus: string,
): FormulaStep<number> {
  const costStep = formulaStep(projectAaveV4AnnualInterestCost(v4DebtState), tracked, sourceStatus);
  if (!costStep.ok) return costStep;

  const totalDebt = v4DebtState.drawnDebt + v4DebtState.premiumDebt;
  if (totalDebt === 0) {
    return {
      ok: true,
      value: v4DebtState.baseDrawnApr,
      tracked: costStep.tracked,
      warnings: costStep.warnings,
    };
  }

  return {
    ok: true,
    value: costStep.value / totalDebt,
    tracked: costStep.tracked,
    warnings: costStep.warnings,
  };
}

/**
 * Derives a V4 portfolio's post-change `v4DebtState` for a debt-altering
 * action (borrow or repay) — V4 Readiness Audit §12 Stage 11, resolved
 * with the real protocol-backed repayment rule at Stage 12.
 *
 * **Stage 12 authoritative protocol audit (read directly from
 * `aave/aave-v4`'s public source, current as of 2026-08-16) answered the
 * question Stage 11 could not:**
 *
 *   - **Repay (partial or full) — fully deterministic, not ambiguous.**
 *     `src/spoke/Spoke.sol`'s `repay` never calls `_notifyRiskPremiumUpdate`
 *     (confirmed by reading the function body directly — only `borrow`/
 *     `withdraw`/`liquidationCall`/`setUsingAsCollateral`/
 *     `updateUserRiskPremium`/`updateUserDynamicConfig` do), so
 *     `riskPremium` is UNCHANGED by a repayment. `baseDrawnApr` is a
 *     Hub-level asset parameter no user action ever changes. The only
 *     question — how the dollar amount splits between `drawnDebt` and
 *     `premiumDebt` — is answered exactly by
 *     `UserPositionUtils.sol`'s `calculateRestoreAmount`: **premium debt
 *     first, then drawn debt with the remainder** (see
 *     `engine/protocols/aaveV4/deriveDebtAfterRepayment.ts`'s own header
 *     comment for the verbatim Solidity and the full derivation). Delegated
 *     to that real, tested Engine formula below — not re-implemented here.
 *   - **Borrow — genuinely NOT locally derivable, still fail-closed.**
 *     `Spoke.sol`'s `borrow` DOES call `_notifyRiskPremiumUpdate`, driven
 *     by a freshly-recomputed Risk Premium from
 *     `_refreshAndValidateUserAccountData`. `docs/overview.md`'s "Risk
 *     Premium Algorithm" requires the user's ENTIRE collateral set
 *     (`RP_u = Σ(CR_i·C_i·P_i) / Σ(C_i·P_i)`, sorted by Collateral Risk) —
 *     data this codebase's single-BTC-collateral domain model has never
 *     captured, not a persistence gap that could be closed by extending
 *     `AaveV4DebtState` with one more field (the preferred-hierarchy
 *     option B this stage's own instructions describe does not apply
 *     here: the missing input is a WHOLE portfolio's worth of
 *     multi-collateral data, not "raw state we already have but did not
 *     persist"). A post-borrow `riskPremium` — and therefore
 *     `premiumDebt` — is not knowable from this codebase's persisted
 *     state alone, so it is not guessed. This is hierarchy option D:
 *     "keep it fail-closed and report that as the correct product
 *     limitation," not a lower-confidence shortcut.
 *
 * Returns a `FormulaStep`-compatible result (`services/shared/formulaStep.ts`)
 * so the three consumers (`services/exit/plan.ts`,
 * `services/simulation/portfolioAction.ts`,
 * `services/portfolio/actionPreview.ts`) can compose the repay path's real
 * Engine call into their own tracked `ServiceResult` exactly like every
 * other Engine call in this codebase — `value: v4DebtState` for a no-op
 * (`debtDelta === 0`) and `value: undefined` for an ambiguous borrow both
 * pass the caller's own `tracked` straight through unchanged (no new
 * Engine call happened in either case, so nothing new to track or fail).
 *
 * **`debtDelta` is USD; `deriveAaveV4DebtAfterRepayment` needs a
 * debt-token-QUANTITY repayment amount — a genuine defect found during
 * this stage's own final pre-commit review, not part of the original four
 * fixes.** Every call site computes `debtDelta` the same way V3 always
 * has: against `resolveCanonicalDebtBalance`/`engineInput.debt.balance`
 * (both USD — the Debt form's "Debt amount" field, Simulation's
 * `debtDelta`, and Exit Planner's `targetExit.exit.repayment` are all
 * dollar figures). `deriveAaveV4DebtAfterRepayment` in turn operates on
 * `drawnDebt`/`premiumDebt` in the debt asset's own native token units
 * (P1-D1's real on-chain quantities). Passing the USD amount straight
 * through as a token-quantity repayment — as this function did before
 * this fix — misapplies a $X repayment as an X-TOKEN repayment,
 * mis-splitting premium-first/drawn-remainder by the price factor and
 * leaving the position's canonical USD debt away from the user's actual
 * target by exactly that gap. Converted below via division by the
 * authoritative `debtAssetPriceUsd` — the inverse of `calculateDebtAssetValue`'s
 * own `quantity × price`, not a duplication of it — with the same
 * manual-mode fallback established elsewhere in this file: the raw USD
 * delta is used directly as the quantity delta when no price is
 * available, exactly reproducing this function's pre-P1-D3 behavior for
 * manual V4.
 */
export function deriveV4DebtStateAfterDelta(
  v4DebtState: AaveV4DebtState,
  debtDelta: number,
  tracked: TrackedFormulaVersion,
  sourceStatus: string,
): FormulaStep<AaveV4DebtState | undefined> {
  if (debtDelta === 0) {
    return { ok: true, value: v4DebtState, tracked, warnings: [] };
  }

  if (debtDelta > 0) {
    // Borrow — genuinely ambiguous, see this function's own doc comment.
    return { ok: true, value: undefined, tracked, warnings: [] };
  }

  const repaymentAmountUsd = -debtDelta;
  const repaymentAmountQuantity =
    v4DebtState.debtAssetPriceUsd === undefined
      ? repaymentAmountUsd
      : repaymentAmountUsd / v4DebtState.debtAssetPriceUsd;

  const repaymentStep = formulaStep(
    deriveAaveV4DebtAfterRepayment({
      drawnDebt: v4DebtState.drawnDebt,
      premiumDebt: v4DebtState.premiumDebt,
      repaymentAmount: repaymentAmountQuantity,
    }),
    tracked,
    sourceStatus,
  );
  if (!repaymentStep.ok) return repaymentStep;

  return {
    ok: true,
    value: {
      drawnDebt: repaymentStep.value.drawnDebt,
      premiumDebt: repaymentStep.value.premiumDebt,
      baseDrawnApr: v4DebtState.baseDrawnApr,
      riskPremium: v4DebtState.riskPremium,
      // V4 Readiness Audit §12 P1-D3 — a repayment changes the outstanding
      // debt *quantity*, never the debt asset's own oracle price, so the
      // authoritative price (when the source state carried one) is carried
      // through unchanged to the derived after-state. Omitting it here
      // would make every live-sourced repayment preview fail
      // `checkAaveV4DebtAssetPriceAvailable` on the after-state for no
      // real reason — the price this derived state should be valued at is
      // exactly the one it started with.
      debtAssetPriceUsd: v4DebtState.debtAssetPriceUsd,
    },
    tracked: repaymentStep.tracked,
    warnings: repaymentStep.warnings,
  };
}

/**
 * Pairs a V4 debt delta's resulting `v4DebtState` with the generic
 * `debt.balance` scalar it implies — V4 Edit-Time Debt Model Audit's own
 * central finding: `services/portfolio/actionPreview.ts` and
 * `services/simulation/portfolioAction.ts` each independently computed
 * their own "after" `debt.balance` as `portfolio.debt.balance + debtDelta`
 * — the RAW stored field, never `resolveCanonicalDebtBalance` — while
 * `v4DebtState` was correctly derived via `deriveV4DebtStateAfterDelta`
 * above. The two numbers agree only by algebraic coincidence, and only
 * when the raw field was already exactly in sync with the real quantity
 * total to begin with; the instant it drifts for any reason (a stale
 * persisted record, a partial write elsewhere), that raw-arithmetic path
 * propagates and compounds the drift forever, since nothing about it
 * ever re-derives from the real canonical total.
 *
 * **The fix is structural, not a patch to the arithmetic**: `debtBalance`
 * here is never computed as `oldBalance + delta`. It is
 * `resolveCanonicalDebtBalance` applied to the portfolio WITH the
 * already-derived `v4DebtState` — the exact same canonical chokepoint
 * every other correct V4 consumer in this codebase already uses
 * (`mapApplicationPortfolioToEngineInput`, `services/export/CsvExporter.ts`,
 * `services/loop/finalPortfolio.ts`). A portfolio whose raw `debt.balance`
 * had drifted from canonical therefore self-heals the moment any V4
 * debt-changing operation runs through this function — the drift simply
 * cannot propagate, because the new value never reads the old one.
 *
 * Every caller must already have confirmed `portfolio.protocolVersion === 'v4'`
 * and `portfolio.v4DebtState !== undefined` before calling this (mirrors
 * `deriveV4DebtStateAfterDelta`'s own non-optional `v4DebtState`
 * parameter) — `portfolio` itself is still needed here only to read
 * `protocolVersion`/`debt.balance` (the latter only as
 * `resolveCanonicalDebtBalance`'s own defined-but-unreachable V3/no-op
 * fallback), never as an input to any arithmetic.
 */
export interface AaveV4DebtDeltaResult {
  v4DebtState: AaveV4DebtState | undefined;
  debtBalance: number;
}

export function deriveV4DebtBalanceAfterDelta(
  portfolio: ApplicationPortfolio,
  v4DebtState: AaveV4DebtState,
  debtDelta: number,
  tracked: TrackedFormulaVersion,
  sourceStatus: string,
): FormulaStep<AaveV4DebtDeltaResult> {
  const step = deriveV4DebtStateAfterDelta(v4DebtState, debtDelta, tracked, sourceStatus);
  if (!step.ok) return step;

  const debtBalance = resolveCanonicalDebtBalance({ ...portfolio, v4DebtState: step.value });

  return {
    ok: true,
    value: { v4DebtState: step.value, debtBalance },
    tracked: step.tracked,
    warnings: step.warnings,
  };
}
