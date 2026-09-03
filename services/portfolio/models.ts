/**
 * Portfolio models — 06_TASKS.md M3-004 ("Implement Portfolio Mapping
 * Utilities"): "Create mapping functions between persistence models,
 * application models, and Formula Engine inputs."
 *
 * SCOPE NOTE (read before extending): M3-004 depends only on M2-002 and
 * M3-001 — it does **not** depend on M4-001 ("Define Application-Layer
 * Portfolio Models", which specifies Portfolio identity, name,
 * description, base currency, settings, and created/updated timestamps).
 * The relationship is the reverse: M4-001 depends on M3-004. So neither a
 * persistence schema nor a full application-layer model is formally
 * defined yet anywhere in the specification when this file is written.
 *
 * The types below are therefore deliberately **minimal**: exactly the
 * fields required to produce `engine`'s `PortfolioInput` (collateral,
 * debt, market, protocol), and nothing more. M4-001 may — and, per its
 * own "Include" list, almost certainly will — extend `ApplicationPortfolio`
 * with identity/description/base-currency/settings/timestamp fields later.
 * Adding those here now would be inventing M4-001's scope, not M3-004's.
 */
import type {
  AaveProtocolVersion,
  AaveV4DebtProjectionRequest,
  CollateralPosition,
  DebtPosition,
  MarketPrices,
  ProtocolParameters,
} from '@/engine';

/**
 * Aave V4 live-position identity — Stage 4A (V4 Readiness Audit §12).
 * The on-chain address whose V4 Spoke position a portfolio's live debt
 * figures should be read from (`infrastructure/protocols/aave/v4`'s
 * `fetchAaveV4DebtSnapshot`, Stage 3) — kept as its own, separate,
 * optional sub-object rather than a bare field on `ApplicationPortfolio`,
 * per the Stage 4 audit's own conclusion: live on-chain position identity
 * must stay structurally distinct from strategy quantities
 * (`collateral`/`debt`), market data, and protocol parameters, exactly
 * how `PortfolioSettings.safetyTargets` already keeps a different kind of
 * per-portfolio configuration in its own sub-object rather than
 * flattening it onto the record.
 *
 * **Not account/auth identity.** `userAddress` identifies which on-chain
 * position to read, not who owns this application record — deliberately
 * unrelated to `services/auth`'s `AuthUser`/`stores/authStore.ts` (a
 * Supabase email/password identity with no wallet concept at all).
 * Anonymous, fully local portfolios must be able to set this exactly like
 * signed-in ones; nothing here depends on `authStore`.
 *
 * **Does not duplicate `debt.asset`.** Which stablecoin this portfolio's
 * debt is denominated in is already owned by `ApplicationPortfolio.debt.asset`
 * — this type carries only what that field cannot already express: the
 * wallet address itself.
 *
 * `userAddress` uses the plain ambient `` `0x${string}` `` template-literal
 * type, not an import from `infrastructure/protocols/aave/v4` — the same
 * "duplicate the shape, never cross-import between layers" convention
 * `AaveProtocolVersion` already establishes between `engine/protocols/types.ts`
 * and `infrastructure/protocols/aave/types.ts`. The portfolio/domain layer
 * stays independent of RPC/ABI infrastructure by construction.
 */
export interface AaveV4PositionIdentity {
  userAddress: `0x${string}`;
}

/**
 * Aave V4 live debt shape — Stage 6 (V4 Readiness Audit §12), closing the
 * "Portfolio/Dashboard data-gap analysis" finding from the original Stage
 * 4 design audit. `services/simulation/scenario.ts`'s own header comment
 * has, since Stage 2, explicitly named this exact gap as the reason V4
 * interest-scenario simulation fails closed for every real portfolio:
 * the Engine's V4 math (`engine/protocols/aaveV4`) is real, but "this
 * Service's portfolio model doesn't have a source for" `drawnDebt`/
 * `premiumDebt`/`riskPremium`. This type is that source.
 *
 * Kept as its own optional sub-object, the same reasoning as
 * `AaveV4PositionIdentity` above: V4's live debt shape is fundamentally
 * different data from V3's single `debt.balance` figure (two separately-
 * accruing streams plus a currently-effective Risk Premium — see
 * `engine/protocols/types.ts`'s own `AaveV4DebtProjectionRequest` doc
 * comment), not a value that fits into the existing `debt`/`protocol`
 * fields without either overloading their meaning or losing precision.
 *
 * `Omit<AaveV4DebtProjectionRequest, 'protocolVersion' | 'elapsedDays'>`
 * — a type-only derivation from the Engine's own already-public request
 * shape (`@/engine`), not a hand-duplicated interface, the same pattern
 * `infrastructure/protocols/aave/v4/types.ts`'s own `AaveV4EngineDebtInputs`
 * already uses for the identical Omit. The two are intentionally
 * separate nominal types in separate layers (this one belongs to the
 * domain/application layer, that one to infrastructure), mirroring how
 * `AaveProtocolVersion` is deliberately duplicated, not shared, between
 * `engine/protocols/types.ts` and `infrastructure/protocols/aave/types.ts`
 * — but being structurally identical Omits of the same Engine type means
 * a future caller can assign a Stage 4B `AaveV4DebtSnapshot.engineInputs`
 * value directly into this field with zero mapping code, by construction.
 * `elapsedDays` is excluded because it is a projection horizon supplied
 * per-calculation, not persisted portfolio state, exactly like V3's
 * `elapsedDays` was never stored either.
 *
 * **Stage 6 scope note**: this field is defined and persistable
 * (`services/persistence/schemas/portfolio.schema.ts`,
 * `stores/portfolioStore.ts`'s `setAaveV4DebtState`) but consumed by
 * nothing yet — `services/simulation/scenario.ts`'s V4 dispatch guard is
 * intentionally untouched this stage (V4 Readiness Audit §12 recommends
 * wiring it as a later, separate stage). No live-sync mechanism
 * populates it automatically either. Same deliberate "no cross-inference"
 * discipline as `v4Position`: setting this does not imply or require
 * `protocolVersion: 'v4'` or a set `v4Position`, and vice versa.
 */
export type AaveV4DebtState = Omit<
  AaveV4DebtProjectionRequest,
  'protocolVersion' | 'elapsedDays'
> & {
  /**
   * V4 Readiness Audit §12 P1-D3 — the debt asset's V4-authoritative
   * oracle price, consumed by `services/portfolio/mapping.ts`'s
   * `resolveCanonicalDebtBalance` to compute live debt USD value via the
   * canonical `calculateDebtAssetValue` (P1-D2), instead of the legacy
   * implicit-$1 raw-quantity sum. Added via intersection, not folded into
   * the `Omit<AaveV4DebtProjectionRequest, ...>` base — that base stays
   * exactly what `engine/protocols/aaveV4/projectAaveV4Debt.ts` accepts,
   * unwidened; every existing consumer of `v4DebtState` reads named
   * fields explicitly (never spreads the whole object into a
   * stricter-typed call), so this extra field is inert everywhere except
   * the one place that now reads it.
   *
   * **`undefined` for every MANUAL `v4DebtState`** — manual/hypothetical
   * V4 mode has no oracle to read from and, per this stage's own
   * explicit scope, deliberately RETAINS the existing implicit-$1
   * assumption unchanged (see `resolveCanonicalDebtBalance`'s own
   * comment). Only `hooks/useAaveV4LiveSync.ts`'s live sync ever
   * populates this field.
   */
  debtAssetPriceUsd?: number;
};

/**
 * The application-layer Portfolio shape, as far as M3-004 defines it.
 * Every field here is already validated and Engine-compatible — reusing
 * the Engine's own published domain types (`@/engine`'s
 * `CollateralPosition`/`DebtPosition`/`MarketPrices`/`ProtocolParameters`,
 * M2-002) rather than duplicating them, per this batch's instruction to
 * reuse existing shared contracts where appropriate.
 *
 * **`protocolVersion` (V4 Readiness Audit §12 Stage 1)** — which Aave
 * protocol version this portfolio's debt is denominated under. Optional,
 * and deliberately never written by any persistence/mapping code this
 * stage (`services/persistence/*`, `mapPersistencePortfolioToApplicationPortfolio`
 * are untouched) — every currently-persisted or newly-created portfolio
 * has this field `undefined`, which every consumer must read as Aave V3
 * (backward compatible by construction, not by a migration). Stage 1 adds
 * no user-facing way to set this to `'v4'`; it exists so
 * `services/simulation/scenario.ts` has a real, typed place to resolve
 * protocol version from, and so tests can construct a V4 portfolio to
 * prove the unsupported path fails closed (§12 Stage 1 requirements).
 *
 * **`v4Position` (V4 Readiness Audit §12 Stage 4A, persisted since
 * Stage 5)** — same backward-compatibility discipline as
 * `protocolVersion`: optional, `undefined` on every portfolio unless
 * explicitly set via `stores/portfolioStore.ts`'s `setAaveV4Position`
 * (Stage 5), which also durably persists it
 * (`services/persistence/schemas/portfolio.schema.ts`). Still NOT wired
 * into `PersistencePortfolio`/`mapPersistencePortfolioToApplicationPortfolio`
 * below — those remain the M3-004-era defensive mapper with no
 * production caller (see that interface's own comment), not the real
 * write/read path, which is `persistedPortfolioPayloadSchema` directly.
 *
 * **`v4DebtState` (V4 Readiness Audit §12 Stage 6)** — same pattern as
 * `v4Position`: optional, persisted via
 * `services/persistence/schemas/portfolio.schema.ts` and
 * `stores/portfolioStore.ts`'s `setAaveV4DebtState`, `undefined` on
 * every portfolio until explicitly set. See `AaveV4DebtState`'s own doc
 * comment above for what it holds and why.
 *
 * **`v4CollateralRisk` (V4 Readiness Audit §12 Stage 23C)** — same
 * "extend model, schema, and Store action together" pattern as
 * `v4DebtState`: optional, persisted via
 * `services/persistence/schemas/portfolio.schema.ts` and
 * `stores/portfolioStore.ts`'s `setAaveV4CollateralRisk`, `undefined` on
 * every portfolio until explicitly set. See `AaveV4CollateralRiskConfig`'s
 * own doc comment below for what it holds and why.
 */
export interface ApplicationPortfolio {
  collateral: CollateralPosition;
  debt: DebtPosition;
  market: MarketPrices;
  protocol: ProtocolParameters;
  /**
   * V1.1 Batch 1 (Live-Data Trust Parity) — same `AaveV4DataSource`
   * provenance marker `v4DebtStateSource` already uses below, reused
   * rather than duplicated: the concept ("did a human type this, or did
   * a live RPC read produce it") is identical for V3's `market`/
   * `protocol`, even though the type's own name predates V3 having a
   * source concept at all. Optional for the same backward-compatibility
   * reason as every V4 field here — a portfolio persisted before this
   * batch has it `undefined`, normalized to `'manual'` on load by
   * `normalizePortfolioProvenance` (`stores/portfolioStore.ts`), the
   * conservative "cannot prove a historical value is still live" default
   * `v4DebtStateSource` itself already establishes. Unlike the V4
   * fields, `market`/`protocol` are never themselves optional — every
   * portfolio has always had a value for both since Milestone 4 — so
   * this source field, once normalized, is likewise always defined, not
   * "defined iff the value is defined."
   */
  marketSource?: AaveV4DataSource;
  /** Same reasoning as `marketSource` above, independently, for `protocol`. */
  protocolSource?: AaveV4DataSource;
  protocolVersion?: AaveProtocolVersion;
  v4Position?: AaveV4PositionIdentity;
  v4DebtState?: AaveV4DebtState;
  v4CollateralRisk?: AaveV4CollateralRiskConfig;
  /**
   * V4 Readiness Audit §12 Stage 25 — see `AaveV4DataSource`'s own doc
   * comment below. Optional for the same backward-compatibility reason
   * as every other V4 field here: every portfolio persisted before this
   * stage has it `undefined`. **Invariant maintained by every writer**
   * (`stores/portfolioStore.ts`'s `setAaveV4DebtState`, and the
   * `load()` normalization for pre-Stage-25 persisted data): this field
   * is defined if and only if `v4DebtState` is defined — never an
   * orphaned source with no value, never a value with no known source.
   */
  v4DebtStateSource?: AaveV4DataSource;
  /** Same invariant as `v4DebtStateSource`, independently, for `v4CollateralRisk`. See `setAaveV4CollateralRisk`'s own comment. */
  v4CollateralRiskSource?: AaveV4DataSource;
  /**
   * V4 Readiness Audit §12 P2-1 — ISO 8601 timestamp of the last
   * successful `v4DebtState` write, manual or live. Same "defined iff the
   * value it describes is defined" invariant as `v4DebtStateSource`,
   * maintained by the same writer (`stores/portfolioStore.ts`'s
   * `setAaveV4DebtState`) — every call that sets `v4DebtState` also sets
   * this to the current time, and every call that clears it (address
   * change) clears this too. A failed live refresh never reaches this
   * field at all (the Store action is only called on a *successful*
   * fetch or a validated manual entry) — a stale/failed refresh therefore
   * never overwrites a previously-recorded success, which is exactly the
   * "reloading must not erase the known last-successful-fetch timestamp"
   * requirement this field exists to satisfy. `undefined` on every
   * portfolio persisted before this stage — no migration backfills a
   * fabricated value, matching every other V4 field's own backward-
   * compatibility discipline.
   */
  v4DebtStateUpdatedAt?: string;
  /** Same invariant and reasoning as `v4DebtStateUpdatedAt`, independently, for `v4CollateralRisk`/`setAaveV4CollateralRisk`. */
  v4CollateralRiskUpdatedAt?: string;
  /**
   * V4 Mixed-Provenance UX batch — `baseDrawnApr` (inside `v4DebtState`)
   * is genuinely address-independent market data (`IHub.getAssetDrawnRate`,
   * `stores/aaveV4BaseDrawnRateStore.ts`), not wallet-position data like
   * its three siblings (`drawnDebt`/`premiumDebt`/`riskPremium`) — but it
   * has always shared `v4DebtStateSource`'s one flag with them, so a
   * live-fetched base rate saved alongside a manually-entered wallet
   * position was recorded (and displayed) as `'manual'` for the whole
   * group, silently losing its own real provenance. This field tracks it
   * independently. Same "defined iff `v4DebtState` is defined" invariant
   * as `v4DebtStateSource` (never an orphaned source, never a value with
   * no known source), same conservative `'manual'` default for any
   * portfolio persisted before this batch (`stores/portfolioStore.ts`'s
   * `normalizePortfolioProvenance`) — a value's ABSENCE of provenance is
   * never silently read as `'live'`. Written by
   * `stores/portfolioStore.ts`'s `setAaveV4DebtState`, which now accepts
   * this as an independent 4th argument (defaulting to whatever the
   * whole-group `source` argument is, preserving every pre-existing
   * caller's behavior unchanged — the wallet-position live-sync hook
   * genuinely reads `baseDrawnApr` off the same on-chain call as
   * `drawnDebt`/`premiumDebt`/`riskPremium`, so defaulting it to match
   * `source` there is not an approximation, it is correct). The two
   * edit-time forms that can genuinely diverge from the group source —
   * `app/portfolios/new/NewPortfolioV4Fields.tsx` (creation) and
   * `app/portfolio/ManualAaveV4StateForm.tsx` (manual edit) — now pass it
   * explicitly, computed from their own already-existing
   * `baseDrawnAprPrefilled`/`dirtyFields.baseDrawnApr` local tracking
   * (previously computed and then discarded at the persistence boundary,
   * see this batch's own audit finding).
   */
  v4BaseDrawnAprSource?: AaveV4DataSource;
}

/**
 * Aave V4 collateral-risk configuration — V4 Readiness Audit §12 Stage
 * 23C, closing the Stage 23 finding that Health Factor/liquidation-price/
 * LTV calculations had no source for V4's real risk parameter and were
 * reading V3's `protocol.liquidationThreshold` unconditionally instead.
 * Stage 23B's own authoritative Solidity trace (`aave/aave-v4` commit
 * `2524fe4018a42750300e114f2a8c4355df62a878`, `Spoke.sol`'s
 * `_processUserAccountData`/`Spoke.borrow()`) established that V4 has no
 * V3-shaped `maxLoanToValue`/`liquidationThreshold` split at all —
 * `collateralFactor` alone governs both borrow capacity and liquidation
 * eligibility, via `Health Factor = Σ(collateralFactor_i × collateralValue_i)
 * / totalDebtValue`.
 *
 * **`dynamicConfigKey` is preserved deliberately, not discarded** — it
 * records exactly which dynamic-config version `collateralFactor` was
 * read at (`ISpoke.UserPosition.dynamicConfigKey`, the user's own bound
 * snapshot). Aave V4's dynamic-config mapping is versioned, and a user's
 * position can remain bound to an older config than the reserve's
 * current one until their next risk-increasing action (`borrow`/
 * `withdraw`/`setUsingAsCollateral`/`updateUserDynamicConfig`) — see
 * `infrastructure/protocols/aave/v4/index.ts`'s
 * `fetchAaveV4CollateralRiskSnapshot` for the full mechanism. This field
 * is provenance, not a value any calculation consumes.
 *
 * Kept as its own optional sub-object, the same reasoning as
 * `AaveV4PositionIdentity`/`AaveV4DebtState` above — V4's collateral-risk
 * shape is fundamentally different data from V3's flat
 * `maxLoanToValue`/`liquidationThreshold` pair, not a value that fits
 * into `protocol` without overloading its meaning. `protocol` itself is
 * never reinterpreted or overwritten by this type's existence — V3
 * portfolios, and every existing V3-shaped calculation, are completely
 * unaffected.
 *
 * **Consumed by the core calculation layer as of Stage 23D** —
 * `services/portfolio/mapping.ts`'s `resolveRiskCapacityFraction`/
 * `checkAaveV4CollateralRiskAvailable` dispatch `collateralFactor` (never
 * `protocol.liquidationThreshold`/`maxLoanToValue`) into
 * `calculatePortfolioSummary` (Health Factor, liquidation price/distance/
 * buffer), `services/simulation/scenario.ts` (both scenario types), and
 * `services/portfolio/borrowCapacity.ts` (maximum additional borrow). A V4
 * portfolio with no synced `v4CollateralRisk` fails those calculations
 * closed rather than falling back to V3 semantics. Loop Builder UI, Exit
 * Planner UI, Recommendations UI, and exports still consume the V3-shaped
 * `PortfolioSummary`/`SimulationResult` output types unchanged — those UI
 * layers do not yet know they're looking at protocol-aware numbers for a
 * V4 portfolio; propagating that awareness into presentation is deferred
 * to the next stage.
 */
export interface AaveV4CollateralRiskConfig {
  /** Decimal fraction (e.g. `0.75` for 75%) — V4's `DynamicReserveConfig.collateralFactor`, BPS-scaled on-chain. */
  collateralFactor: number;
  /** The user's own bound dynamic-config snapshot key this `collateralFactor` was read at (`ISpoke.UserPosition.dynamicConfigKey`) — NOT necessarily the reserve's current key. */
  dynamicConfigKey: number;
}

/**
 * V4 state provenance — V4 Readiness Audit §12 Stage 25 ("Manual/
 * Hypothetical Mode"). `'manual'`: the user typed this value directly
 * (no wallet, no RPC call, no real Aave position required —
 * `hooks/useAaveV4CollateralRiskLiveSync.ts`/`useAaveV4LiveSync.ts` never
 * write this). `'live'`: this value was written by one of those two
 * live-sync hooks from a real, successful on-chain read.
 *
 * **Independent per dimension, deliberately.** `v4DebtStateSource` and
 * `v4CollateralRiskSource` can disagree at any moment — e.g. a user
 * manually enters both, later adds a wallet address, and the debt-state
 * live fetch succeeds before the collateral-risk one does (or one keeps
 * failing while the other succeeds). Neither field infers or waits on
 * the other, the same "no cross-inference" discipline `v4Position`/
 * `v4DebtState`/`v4CollateralRisk` themselves already established.
 *
 * **Not itself a freshness/staleness concept** — `'live'` alone doesn't
 * mean "current," only "came from a real on-chain read at some point."
 * Freshness for `'live'` data is still `useAaveV4LiveDataStore`/
 * `useAaveV4CollateralRiskLiveDataStore`'s own `lastFetchedAt`
 * (`utils/protocolStatus.ts`'s existing staleness check, unchanged). A
 * `'manual'` value has no independent "freshness" of its own to check —
 * it's exactly as current as whatever the user last typed, by
 * definition, matching how V3's own manually-tracked `debt.balance` has
 * never had a staleness concept either.
 */
export type AaveV4DataSource = 'manual' | 'live';

/**
 * The persistence-layer Portfolio shape, as far as M3-004 defines it.
 * Fields are optional/nullable to model real persisted data honestly —
 * a stored record may have a missing or null field (a legacy record, a
 * partially-filled draft, a malformed import) — which is exactly what
 * M3-004's "Validate required fields" Requirement exists to catch at the
 * persistence → application mapping boundary, not silently coerce.
 */
export interface PersistenceCollateralPosition {
  asset?: string | null;
  quantity?: number | null;
}

export interface PersistenceDebtPosition {
  asset?: string | null;
  balance?: number | null;
}

export interface PersistenceMarketPrices {
  btcPriceUsd?: number | null;
}

export interface PersistenceProtocolParameters {
  maxLoanToValue?: number | null;
  liquidationThreshold?: number | null;
  borrowApr?: number | null;
  supplyApr?: number | null;
}

export interface PersistencePortfolio {
  collateral?: PersistenceCollateralPosition | null;
  debt?: PersistenceDebtPosition | null;
  market?: PersistenceMarketPrices | null;
  protocol?: PersistenceProtocolParameters | null;
}
