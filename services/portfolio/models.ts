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
export type AaveV4DebtState = Omit<AaveV4DebtProjectionRequest, 'protocolVersion' | 'elapsedDays'>;

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
 */
export interface ApplicationPortfolio {
  collateral: CollateralPosition;
  debt: DebtPosition;
  market: MarketPrices;
  protocol: ProtocolParameters;
  protocolVersion?: AaveProtocolVersion;
  v4Position?: AaveV4PositionIdentity;
  v4DebtState?: AaveV4DebtState;
}

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
